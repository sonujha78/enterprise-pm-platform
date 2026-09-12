import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  // Compute progress on read: completed tasks / total tasks.
  // Avoids storing a stale counter that can drift from actual task state.
  private computeProgress(tasks: { status: string }[]): number {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
    return Math.round((completed / tasks.length) * 100);
  }

  private async assertMembership(projectId: string, userId: string) {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!membership && project?.ownerId !== userId) {
      throw new ForbiddenException('You are not a member of this project');
    }
  }

  async createProject(
    organizationId: string,
    ownerId: string,
    dto: CreateProjectDto,
  ) {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        organizationId,
        ownerId,
        teamId: dto.teamId,
        members: {
          create: { userId: ownerId, role: 'ADMIN' },
        },
      },
      include: { tasks: true },
    });

    return { ...project, progress: this.computeProgress(project.tasks) };
  }

  async listProjects(organizationId: string, query: QueryProjectsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: Prisma.ProjectWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [projects, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: { tasks: { select: { status: true } } },
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: projects.map((p) => ({
        ...p,
        progress: this.computeProgress(p.tasks),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProject(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      include: {
        tasks: true,
        members: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        },
        owner: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return { ...project, progress: this.computeProgress(project.tasks) };
  }

  async updateProject(
    organizationId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ) {
    const existing = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    // Optimistic locking: reject if the version doesn't match (concurrent edit)
    if (existing.version !== dto.version) {
      throw new ConflictException(
        'Project was modified by someone else. Please refresh and try again.',
      );
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status as any,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        version: { increment: 1 },
      },
      include: { tasks: true },
    });

    return { ...updated, progress: this.computeProgress(updated.tasks) };
  }

  async archiveProject(organizationId: string, projectId: string) {
    const existing = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.project.delete({ where: { id: projectId } });
  }

  async addMember(organizationId: string, projectId: string, dto: AddProjectMemberDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: dto.userId } },
    });

    if (existing) {
      throw new ConflictException('User is already a project member');
    }

    return this.prisma.projectMember.create({
      data: {
        projectId,
        userId: dto.userId,
        role: (dto.role as any) ?? 'DEVELOPER',
      },
    });
  }

  async removeMember(organizationId: string, projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.prisma.projectMember.deleteMany({
      where: { projectId, userId },
    });

    return { message: 'Member removed from project' };
  }
}
