import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'DUE_DATE_REMINDER'
  | 'COMMENT_MENTION'
  | 'PROJECT_INVITATION';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('email') private emailQueue: Queue,
  ) {}

  async create(
    userId: string,
    type: NotificationType,
    message: string,
    emailTo?: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: { userId, type: type as any, message },
    });

    if (emailTo) {
      await this.emailQueue.add('send-notification-email', {
        to: emailTo,
        subject: type.replace(/_/g, ' '),
        message,
      });
    }

    return notification;
  }

  async listForUser(userId: string, query: QueryNotificationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where = {
      userId,
      ...(query.isRead !== undefined ? { isRead: query.isRead } : {}),
    };

    const [notifications, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data: notifications,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), unreadCount },
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { message: 'All notifications marked as read' };
  }

  async scheduleDueDateReminder(taskId: string, delayMs: number) {
    await this.notificationsQueue.add(
      'due-date-reminder',
      { taskId },
      { delay: delayMs },
    );
  }
}
