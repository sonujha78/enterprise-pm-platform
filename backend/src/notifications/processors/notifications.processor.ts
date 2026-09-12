import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'due-date-reminder') {
      const { taskId } = job.data;

      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        include: { assignee: true },
      });

      if (!task || !task.assigneeId || task.status === 'COMPLETED') {
        this.logger.log(`Skipping reminder for task ${taskId} (completed or unassigned)`);
        return;
      }

      await this.prisma.notification.create({
        data: {
          userId: task.assigneeId,
          type: 'DUE_DATE_REMINDER',
          message: `Task "${task.title}" is due soon`,
        },
      });

      this.logger.log(`Due-date reminder created for task ${taskId}`);
    }
  }
}
