import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { AddDependencyDto } from './dto/add-dependency.dto';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  private async assertProjectInOrg(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async createTask(
    organizationId: string,
    projectId: string,
    creatorId: string,
    dto: CreateTaskDto,
  ) {
    await this.assertProjectInOrg(organizationId, projectId);

    if (dto.parentTaskId) {
      const parent = await this.prisma.task.findFirst({
        where: { id: dto.parentTaskId, projectId },
      });
      if (!parent) {
        throw new NotFoundException('Parent task not found in this project');
      }
    }

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: (dto.priority as any) ?? 'MEDIUM',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        tags: dto.tags ?? [],
        projectId,
        creatorId,
        assigneeId: dto.assigneeId,
        parentTaskId: dto.parentTaskId,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        action: 'TASK_CREATED',
        userId: creatorId,
        taskId: task.id,
        metadata: { title: task.title },
      },
    });

    // Notify assignee if one was set at creation
    if (dto.assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assigneeId },
      });
      if (assignee) {
        await this.notificationsService.create(
          assignee.id,
          'TASK_ASSIGNED',
          `You were assigned to task "${task.title}"`,
          assignee.email,
        );
      }
    }

    return task;
  }

  async listTasks(organizationId: string, projectId: string, query: QueryTasksDto) {
    await this.assertProjectInOrg(organizationId, projectId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: Prisma.TaskWhereInput = {
      projectId,
      parentTaskId: null,
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.priority ? { priority: query.priority as any } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [tasks, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: {
          assignee: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          subtasks: true,
          _count: { select: { comments: true, subtasks: true } },
        },
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: tasks,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTask(organizationId: string, projectId: string, taskId: string) {
    await this.assertProjectInOrg(organizationId, projectId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
      include: {
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        creator: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        subtasks: true,
        comments: {
          include: {
            author: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: true,
        dependsOn: {
          include: { blockingTask: { select: { id: true, title: true, status: true } } },
        },
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async updateTask(
    organizationId: string,
    projectId: string,
    taskId: string,
    userId: string,
    dto: UpdateTaskDto,
  ) {
    await this.assertProjectInOrg(organizationId, projectId);

    const existing = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    if (existing.version !== dto.version) {
      throw new ConflictException(
        'Task was modified by someone else. Please refresh and try again.',
      );
    }

    if (dto.status === 'COMPLETED') {
      const blockers = await this.prisma.taskDependency.findMany({
        where: { dependentTaskId: taskId },
        include: { blockingTask: true },
      });
      const incomplete = blockers.filter((b) => b.blockingTask.status !== 'COMPLETED');
      if (incomplete.length > 0) {
        throw new BadRequestException(
          'Cannot complete task: blocking dependencies are not completed yet',
        );
      }
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status as any,
        priority: dto.priority as any,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        tags: dto.tags,
        assigneeId: dto.assigneeId,
        version: { increment: 1 },
      },
    });

    await this.prisma.activityLog.create({
      data: {
        action: 'TASK_UPDATED',
        userId,
        taskId,
        metadata: { changes: JSON.parse(JSON.stringify(dto)) },
      },
    });

    // Notify new assignee if reassigned
    if (dto.assigneeId && dto.assigneeId !== existing.assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assigneeId },
      });
      if (assignee) {
        await this.notificationsService.create(
          assignee.id,
          'TASK_ASSIGNED',
          `You were assigned to task "${updated.title}"`,
          assignee.email,
        );
      }
    }

    return updated;
  }

  async deleteTask(organizationId: string, projectId: string, taskId: string) {
    await this.assertProjectInOrg(organizationId, projectId);

    const existing = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    await this.prisma.task.delete({ where: { id: taskId } });
    return { message: 'Task deleted successfully' };
  }

  async addComment(
    organizationId: string,
    projectId: string,
    taskId: string,
    authorId: string,
    dto: AddCommentDto,
  ) {
    await this.assertProjectInOrg(organizationId, projectId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const comment = await this.prisma.comment.create({
      data: { content: dto.content, taskId, authorId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.prisma.activityLog.create({
      data: {
        action: 'COMMENT_ADDED',
        userId: authorId,
        taskId,
      },
    });

    // Notify task assignee about the new comment (if not commenting on own task)
    if (task.assigneeId && task.assigneeId !== authorId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: task.assigneeId },
      });
      if (assignee) {
        await this.notificationsService.create(
          assignee.id,
          'COMMENT_MENTION',
          `New comment on task "${task.title}"`,
          assignee.email,
        );
      }
    }

    return comment;
  }

  async addDependency(
    organizationId: string,
    projectId: string,
    taskId: string,
    dto: AddDependencyDto,
  ) {
    await this.assertProjectInOrg(organizationId, projectId);

    if (taskId === dto.blockingTaskId) {
      throw new BadRequestException('A task cannot depend on itself');
    }

    const [task, blockingTask] = await Promise.all([
      this.prisma.task.findFirst({ where: { id: taskId, projectId } }),
      this.prisma.task.findFirst({ where: { id: dto.blockingTaskId, projectId } }),
    ]);

    if (!task || !blockingTask) {
      throw new NotFoundException('Task not found in this project');
    }

    const existing = await this.prisma.taskDependency.findUnique({
      where: {
        dependentTaskId_blockingTaskId: {
          dependentTaskId: taskId,
          blockingTaskId: dto.blockingTaskId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('This dependency already exists');
    }

    return this.prisma.taskDependency.create({
      data: {
        dependentTaskId: taskId,
        blockingTaskId: dto.blockingTaskId,
      },
    });
  }

  async removeDependency(
    organizationId: string,
    projectId: string,
    taskId: string,
    blockingTaskId: string,
  ) {
    await this.assertProjectInOrg(organizationId, projectId);

    await this.prisma.taskDependency.deleteMany({
      where: { dependentTaskId: taskId, blockingTaskId },
    });

    return { message: 'Dependency removed' };
  }
}
