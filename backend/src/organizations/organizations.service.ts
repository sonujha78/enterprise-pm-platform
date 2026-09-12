import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getOrganization(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            isEmailVerified: true,
            createdAt: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async inviteUser(organizationId: string, dto: InviteUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenHash = crypto
      .createHash('sha256')
      .update(inviteToken)
      .digest('hex');

    await this.redis.set(
      `org_invite:${inviteTokenHash}`,
      JSON.stringify({ email: dto.email, role: dto.role, organizationId }),
      'EX',
      48 * 60 * 60,
    );

    return {
      message: 'Invitation sent successfully',
      inviteToken,
    };
  }

  async listUsers(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
      },
    });
  }

  async updateUserRole(
    organizationId: string,
    targetUserId: string,
    dto: UpdateUserRoleDto,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found in this organization');
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: dto.role as any },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });
  }

  async setUserActiveStatus(
    organizationId: string,
    targetUserId: string,
    requesterId: string,
    isActive: boolean,
  ) {
    if (targetUserId === requesterId) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found in this organization');
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });
  }
}
