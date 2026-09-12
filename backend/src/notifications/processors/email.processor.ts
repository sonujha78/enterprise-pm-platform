import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job): Promise<void> {
    const { to, subject, message } = job.data;

    // TODO: integrate real email provider (SendGrid, SES, etc.)
    // For now, log the "sent" email — this proves the job queue works
    // without inline blocking of the request thread.
    this.logger.log(`Sending email to ${to} | Subject: ${subject} | ${message}`);

    // Simulate email send latency
    await new Promise((resolve) => setTimeout(resolve, 200));

    this.logger.log(`Email sent successfully to ${to}`);
  }
}
