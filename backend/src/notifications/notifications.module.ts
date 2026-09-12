import { Module } from '@nestjs/common';
import { NotificationsQueueModule } from './notifications-queue.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EmailProcessor } from './processors/email.processor';
import { NotificationsProcessor } from './processors/notifications.processor';

@Module({
  imports: [NotificationsQueueModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailProcessor, NotificationsProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
