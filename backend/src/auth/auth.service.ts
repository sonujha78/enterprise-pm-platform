import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private async hashToken(token: string): Promise<string> {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async generateTokens(user: {
    id: string;
    email: string;
    role: string;
    organizationId: string;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET') as string;
    const accessExpiry = this.configService.get<string>('JWT_ACCESS_EXPIRY', '15m');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') as string;
    const refreshExpiry = this.configService.get<string>('JWT_REFRESH_EXPIRY', '7d');

    const accessToken = this.jwtService.sign(payload, {
      secret: accessSecret,
      expiresIn: accessExpiry,
    } as any);

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiry,
    } as any);

    // Store hashed refresh token in Redis with TTL, keyed by userId
    const refreshTokenHash = await this.hashToken(refreshToken);
    const ttlSeconds = 7 * 24 * 60 * 60; // 7 days
    await this.redis.set(
      `refresh_token:${user.id}:${refreshTokenHash}`,
      '1',
      'EX',
      ttlSeconds,
    );

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const organization = await this.prisma.organization.create({
      data: { name: dto.organizationName },
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'ADMIN',
        organizationId: organization.id,
      },
    });

    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const refreshTokenHash = await this.hashToken(refreshToken);
    const exists = await this.redis.get(
      `refresh_token:${payload.sub}:${refreshTokenHash}`,
    );

    if (!exists) {
      throw new UnauthorizedException('Refresh token revoked or not found');
    }

    // Rotation: delete old, issue new
    await this.redis.del(`refresh_token:${payload.sub}:${refreshTokenHash}`);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return this.generateTokens(user);
  }

  async logout(userId: string, refreshToken: string) {
    const refreshTokenHash = await this.hashToken(refreshToken);
    await this.redis.del(`refresh_token:${userId}:${refreshTokenHash}`);
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always return success (don't leak whether email exists)
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = await this.hashToken(resetToken);

    await this.redis.set(
      `password_reset:${resetTokenHash}`,
      user.id,
      'EX',
      3600, // 1 hour
    );

    // TODO: send email via background job queue (BullMQ) with resetToken
    return {
      message: 'If the email exists, a reset link has been sent',
      // devOnly: remove in production, useful for testing without email service
      resetToken,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = await this.hashToken(token);
    const userId = await this.redis.get(`password_reset:${tokenHash}`);

    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.redis.del(`password_reset:${tokenHash}`);
    return { message: 'Password reset successfully' };
  }

  async verifyEmail(token: string) {
    const tokenHash = await this.hashToken(token);
    const userId = await this.redis.get(`email_verify:${tokenHash}`);

    if (!userId) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });

    await this.redis.del(`email_verify:${tokenHash}`);
    return { message: 'Email verified successfully' };
  }
}
