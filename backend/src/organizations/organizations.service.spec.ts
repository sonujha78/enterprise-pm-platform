import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: any;
  let redis: any;

  beforeEach(async () => {
    prisma = {
      organization: { findUnique: jest.fn() },
      user: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    };
    redis = { set: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getOrganization', () => {
    it('should throw NotFoundException if org does not exist', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      await expect(service.getOrganization('org-1')).rejects.toThrow(NotFoundException);
    });

    it('should return organization with users', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', name: 'Org', users: [] });
      const result = await service.getOrganization('org-1');
      expect(result.id).toBe('org-1');
    });
  });

  describe('inviteUser', () => {
    it('should throw ConflictException if email already registered', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
      await expect(
        service.inviteUser('org-1', { email: 'a@b.com', role: 'DEVELOPER' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create invite and store in redis', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.inviteUser('org-1', { email: 'new@b.com', role: 'DEVELOPER' });
      expect(redis.set).toHaveBeenCalled();
      expect(result.message).toBe('Invitation sent successfully');
    });
  });

  describe('setUserActiveStatus', () => {
    it('should throw ForbiddenException when deactivating self', async () => {
      await expect(
        service.setUserActiveStatus('org-1', 'user-1', 'user-1', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if target user not in org', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.setUserActiveStatus('org-1', 'user-2', 'user-1', false),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deactivate user successfully', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-2' });
      prisma.user.update.mockResolvedValue({ id: 'user-2', email: 'a@b.com', isActive: false });
      const result = await service.setUserActiveStatus('org-1', 'user-2', 'user-1', false);
      expect(result.isActive).toBe(false);
    });
  });
});
