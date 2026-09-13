import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: any;
  let notifications: any;

  beforeEach(async () => {
    prisma = {
      project: { findFirst: jest.fn() },
      task: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      activityLog: { create: jest.fn() },
      comment: { create: jest.fn() },
      taskDependency: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    notifications = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createTask', () => {
    it('should throw NotFoundException if project does not exist', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(
        service.createTask('org-1', 'p1', 'user-1', { title: 'Task 1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if parent task not found', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(
        service.createTask('org-1', 'p1', 'user-1', {
          title: 'Sub',
          parentTaskId: 'missing',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create task and log activity', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.task.create.mockResolvedValue({ id: 't1', title: 'Task 1' });

      const result = await service.createTask('org-1', 'p1', 'user-1', {
        title: 'Task 1',
      });

      expect(result.id).toBe('t1');
      expect(prisma.activityLog.create).toHaveBeenCalled();
    });

    it('should notify assignee when task created with assigneeId', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.task.create.mockResolvedValue({ id: 't1', title: 'Task 1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', email: 'u2@test.com' });

      await service.createTask('org-1', 'p1', 'user-1', {
        title: 'Task 1',
        assigneeId: 'u2',
      });

      expect(notifications.create).toHaveBeenCalledWith(
        'u2',
        'TASK_ASSIGNED',
        expect.any(String),
        'u2@test.com',
      );
    });
  });

  describe('updateTask', () => {
    it('should throw NotFoundException if task does not exist', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(
        service.updateTask('org-1', 'p1', 't1', 'user-1', { version: 1 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on version mismatch', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.task.findFirst.mockResolvedValue({ id: 't1', version: 2 });
      await expect(
        service.updateTask('org-1', 'p1', 't1', 'user-1', { version: 1 } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when completing task with incomplete blockers', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.task.findFirst.mockResolvedValue({ id: 't1', version: 1 });
      prisma.taskDependency.findMany.mockResolvedValue([
        { blockingTask: { status: 'TODO' } },
      ]);

      await expect(
        service.updateTask('org-1', 'p1', 't1', 'user-1', {
          status: 'COMPLETED',
          version: 1,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow completing task when all blockers are completed', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.task.findFirst.mockResolvedValue({ id: 't1', version: 1, assigneeId: null });
      prisma.taskDependency.findMany.mockResolvedValue([
        { blockingTask: { status: 'COMPLETED' } },
      ]);
      prisma.task.update.mockResolvedValue({ id: 't1', status: 'COMPLETED', title: 'T' });

      const result = await service.updateTask('org-1', 'p1', 't1', 'user-1', {
        status: 'COMPLETED',
        version: 1,
      } as any);

      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('addDependency', () => {
    it('should throw BadRequestException if task depends on itself', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
      await expect(
        service.addDependency('org-1', 'p1', 't1', { blockingTaskId: 't1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if either task not found', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.task.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 't2' });

      await expect(
        service.addDependency('org-1', 'p1', 't1', { blockingTaskId: 't2' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if dependency already exists', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.task.findFirst
        .mockResolvedValueOnce({ id: 't1' })
        .mockResolvedValueOnce({ id: 't2' });
      prisma.taskDependency.findUnique.mockResolvedValue({ id: 'dep1' });

      await expect(
        service.addDependency('org-1', 'p1', 't1', { blockingTaskId: 't2' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create dependency successfully', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.task.findFirst
        .mockResolvedValueOnce({ id: 't1' })
        .mockResolvedValueOnce({ id: 't2' });
      prisma.taskDependency.findUnique.mockResolvedValue(null);
      prisma.taskDependency.create.mockResolvedValue({ id: 'dep1' });

      const result = await service.addDependency('org-1', 'p1', 't1', {
        blockingTaskId: 't2',
      });

      expect(result.id).toBe('dep1');
    });
  });

  describe('deleteTask', () => {
    it('should throw NotFoundException if task does not exist', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(service.deleteTask('org-1', 'p1', 't1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete task successfully', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.task.findFirst.mockResolvedValue({ id: 't1' });
      prisma.task.delete.mockResolvedValue({ id: 't1' });

      const result = await service.deleteTask('org-1', 'p1', 't1');
      expect(result.message).toBe('Task deleted successfully');
    });
  });
});
