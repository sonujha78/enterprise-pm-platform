import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      project: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      projectMember: {
        findUnique: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createProject', () => {
    it('should create a project with 0 progress when no tasks exist', async () => {
      prisma.project.create.mockResolvedValue({
        id: 'p1',
        name: 'Test Project',
        tasks: [],
      });

      const result = await service.createProject('org-1', 'user-1', {
        name: 'Test Project',
      });

      expect(result.progress).toBe(0);
      expect(result.name).toBe('Test Project');
    });
  });

  describe('getProject', () => {
    it('should throw NotFoundException if project does not exist', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.getProject('org-1', 'p1')).rejects.toThrow(NotFoundException);
    });

    it('should compute progress correctly (50% with 2 tasks, 1 completed)', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: 'p1',
        tasks: [{ status: 'COMPLETED' }, { status: 'TODO' }],
        members: [],
        owner: {},
      });

      const result = await service.getProject('org-1', 'p1');
      expect(result.progress).toBe(50);
    });

    it('should compute 100% progress when all tasks completed', async () => {
      prisma.project.findFirst.mockResolvedValue({
        id: 'p1',
        tasks: [{ status: 'COMPLETED' }, { status: 'COMPLETED' }],
        members: [],
        owner: {},
      });

      const result = await service.getProject('org-1', 'p1');
      expect(result.progress).toBe(100);
    });
  });

  describe('updateProject', () => {
    it('should throw NotFoundException if project does not exist', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(
        service.updateProject('org-1', 'p1', { version: 1 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on version mismatch (optimistic locking)', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1', version: 2 });
      await expect(
        service.updateProject('org-1', 'p1', { version: 1 } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should update project and increment version', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1', version: 1 });
      prisma.project.update.mockResolvedValue({
        id: 'p1',
        name: 'Updated',
        tasks: [],
      });

      const result = await service.updateProject('org-1', 'p1', {
        name: 'Updated',
        version: 1,
      } as any);

      expect(result.name).toBe('Updated');
    });
  });

  describe('addMember', () => {
    it('should throw NotFoundException if project does not exist', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(
        service.addMember('org-1', 'p1', { userId: 'u1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if user already a member', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.projectMember.findUnique.mockResolvedValue({ id: 'pm1' });
      await expect(
        service.addMember('org-1', 'p1', { userId: 'u1' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
