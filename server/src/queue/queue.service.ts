import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('otp') private readonly otpQueue: Queue,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    @InjectQueue('payments') private readonly paymentsQueue: Queue,
    @InjectQueue('vendors') private readonly vendorsQueue: Queue,
    @InjectQueue('reminders') private readonly remindersQueue: Queue,
  ) {}

  queueOtp(payload: Record<string, unknown>) {
    return this.otpQueue.add('send-otp', payload);
  }

  queueNotification(payload: Record<string, unknown>) {
    return this.notificationsQueue.add('notify', payload);
  }

  queueEmail(payload: Record<string, unknown>) {
    return this.notificationsQueue.add('send-email', payload);
  }

  queuePaymentJob(name: string, payload: Record<string, unknown>) {
    return this.paymentsQueue.add(name, payload, {
      jobId: payload.idempotencyKey as string | undefined,
    });
  }

  queueVendorAlert(payload: Record<string, unknown>) {
    return this.vendorsQueue.add('vendor-alert', payload);
  }

  queueReminder(payload: Record<string, unknown>) {
    return this.remindersQueue.add('scheduled-reminder', payload);
  }

  async getQueueHealth() {
    const [otp, notifications, payments, vendors, reminders] = await Promise.all([
      this.otpQueue.getJobCounts(),
      this.notificationsQueue.getJobCounts(),
      this.paymentsQueue.getJobCounts(),
      this.vendorsQueue.getJobCounts(),
      this.remindersQueue.getJobCounts(),
    ]);

    return {
      otp,
      notifications,
      payments,
      vendors,
      reminders,
    };
  }
}
