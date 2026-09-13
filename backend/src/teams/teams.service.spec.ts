import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TeamsService', () => {
  let service: TeamsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      team: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
      user: { findFirst: jest.fn() },
      teamMember: { findUnique: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TeamsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createTeam', () => {
    it('should create a team', async () => {
      prisma.team.create.mockResolvedValue({ id: 't1', name: 'Backend Team' });
      const result = await service.createTeam('org-1', { name: 'Backend Team' });
      expect(result.name).toBe('Backend Team');
    });
  });

  describe('getTeam', () => {
    it('should throw NotFoundException if team does not exist', async () => {
      prisma.team.findFirst.mockResolvedValue(null);
      await expect(service.getTeam('org-1', 't1')).rejects.toThrow(NotFoundException);
    });

    it('should return team with members', async () => {
      prisma.team.findFirst.mockResolvedValue({ id: 't1', name: 'Team', members: [] });
      const result = await service.getTeam('org-1', 't1');
      expect(result.id).toBe('t1');
    });
  });

  describe('addMember', () => {
    it('should throw NotFoundException if team does not exist', async () => {
      prisma.team.findFirst.mockResolvedValue(null);
      await expect(
        service.addMember('org-1', 't1', { userId: 'u1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user not in organization', async () => {
      prisma.team.findFirst.mockResolvedValue({ id: 't1' });
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.addMember('org-1', 't1', { userId: 'u1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if user already a member', async () => {
      prisma.team.findFirst.mockResolvedValue({ id: 't1' });
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
      prisma.teamMember.findUnique.mockResolvedValue({ id: 'tm1' });
      await expect(
        service.addMember('org-1', 't1', { userId: 'u1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should add member successfully', async () => {
      prisma.team.findFirst.mockResolvedValue({ id: 't1' });
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
      prisma.teamMember.findUnique.mockResolvedValue(null);
      prisma.teamMember.create.mockResolvedValue({ id: 'tm1', teamId: 't1', userId: 'u1' });

      const result = await service.addMember('org-1', 't1', { userId: 'u1' });
      expect(result.userId).toBe('u1');
    });
  });

  describe('removeMember', () => {
    it('should throw NotFoundException if team does not exist', async () => {
      prisma.team.findFirst.mockResolvedValue(null);
      await expect(service.removeMember('org-1', 't1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should remove member successfully', async () => {
      prisma.team.findFirst.mockResolvedValue({ id: 't1' });
      const result = await service.removeMember('org-1', 't1', 'u1');
      expect(result.message).toBe('Member removed from team');
    });
  });
});
