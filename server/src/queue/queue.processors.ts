import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from '../notifications/notifications.service';

@Processor('otp')
export class OtpProcessor extends WorkerHost {
  private readonly logger = new Logger(OtpProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<{ phone: string; message: string }>) {
    await this.notificationsService.sendOtp(job.data.phone, job.data.message);
    this.logger.log(`OTP job processed: ${job.id}`);
  }
}

@Processor('payments')
export class PaymentsProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentsProcessor.name);

  async process(job: Job<Record<string, unknown>>) {
    this.logger.log(`Payments job processed: ${job.name} (${job.id})`);
  }
}

@Processor('vendors')
export class VendorsProcessor extends WorkerHost {
  private readonly logger = new Logger(VendorsProcessor.name);

  async process(job: Job<Record<string, unknown>>) {
    this.logger.log(`Vendor alert processed: ${job.id}`);
  }
}

@Processor('reminders')
export class RemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(RemindersProcessor.name);

  async process(job: Job<Record<string, unknown>>) {
    this.logger.log(`Reminder processed: ${job.id}`);
  }
}

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<Record<string, unknown>>) {
    if (job.name === 'send-email') {
      await this.notificationsService.sendEmail({
        to: String(job.data.to),
        subject: String(job.data.subject),
        template: String(job.data.template),
        variables: (job.data.variables as Record<string, unknown>) ?? {},
      });
    }

    this.logger.log(`Notification job processed: ${job.name} (${job.id})`);
  }
}
