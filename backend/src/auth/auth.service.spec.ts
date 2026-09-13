import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let redis: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organization: {
        create: jest.fn(),
      },
    };

    redis = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mocked.jwt.token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => def ?? 'test-secret'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should throw ConflictException if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'test@test.com' });

      await expect(
        service.register({
          email: 'test@test.com',
          password: 'password123',
          firstName: 'A',
          lastName: 'B',
          organizationName: 'Org',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create organization and user, and return tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.organization.create.mockResolvedValue({ id: 'org-1', name: 'Org' });
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        firstName: 'A',
        lastName: 'B',
        role: 'ADMIN',
        organizationId: 'org-1',
      });

      const result = await service.register({
        email: 'test@test.com',
        password: 'password123',
        firstName: 'A',
        lastName: 'B',
        organizationName: 'Org',
      });

      expect(result.user.email).toBe('test@test.com');
      expect(result.accessToken).toBe('mocked.jwt.token');
      expect(result.refreshToken).toBe('mocked.jwt.token');
      expect(redis.set).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nope@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        isActive: false,
        passwordHash: 'hash',
      });

      await expect(
        service.login({ email: 'test@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        isActive: true,
        passwordHash,
      });

      await expect(
        service.login({ email: 'test@test.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens on valid login', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        isActive: true,
        passwordHash,
        firstName: 'A',
        lastName: 'B',
        role: 'ADMIN',
        organizationId: 'org-1',
      });

      const result = await service.login({
        email: 'test@test.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('mocked.jwt.token');
      expect(result.user.email).toBe('test@test.com');
    });
  });

  describe('logout', () => {
    it('should delete refresh token from redis', async () => {
      const result = await service.logout('user-1', 'some-refresh-token');
      expect(redis.del).toHaveBeenCalled();
      expect(result.message).toBe('Logged out successfully');
    });
  });
});
