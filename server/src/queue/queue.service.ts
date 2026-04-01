import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';

type QueueErrorState = {
  message: string;
  lastLoggedAt: number;
  suppressedCount: number;
};

const QUEUE_ERROR_LOG_WINDOW_MS = 30_000;

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly queueErrors = new Map<string, QueueErrorState>();

  constructor(
    @InjectQueue('otp') private readonly otpQueue: Queue,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    @InjectQueue('payments') private readonly paymentsQueue: Queue,
    @InjectQueue('vendors') private readonly vendorsQueue: Queue,
    @InjectQueue('reminders') private readonly remindersQueue: Queue,
  ) {
    this.bindQueueErrorLogging('otp', this.otpQueue);
    this.bindQueueErrorLogging('notifications', this.notificationsQueue);
    this.bindQueueErrorLogging('payments', this.paymentsQueue);
    this.bindQueueErrorLogging('vendors', this.vendorsQueue);
    this.bindQueueErrorLogging('reminders', this.remindersQueue);
  }

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

  queueVendorAlert(payload: Record<string, unknown>, options?: JobsOptions) {
    return this.vendorsQueue.add('vendor-alert', payload, options);
  }

  queueReminder(payload: Record<string, unknown>, options?: JobsOptions) {
    return this.remindersQueue.add('scheduled-reminder', payload, options);
  }

  async getQueueHealth() {
    const [otp, notifications, payments, vendors, reminders] =
      await Promise.all([
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

  private bindQueueErrorLogging(name: string, queue: Queue) {
    queue.on('error', (error) => {
      this.logQueueError(name, error);
    });
  }

  private logQueueError(name: string, error: unknown) {
    const message = String(error);
    const current = this.queueErrors.get(name);
    const now = Date.now();

    if (
      current &&
      current.message === message &&
      now - current.lastLoggedAt < QUEUE_ERROR_LOG_WINDOW_MS
    ) {
      current.suppressedCount += 1;
      return;
    }

    if (current?.suppressedCount) {
      this.logger.warn(
        `Suppressed ${current.suppressedCount} repeated BullMQ "${name}" errors: ${current.message}`,
      );
    }

    this.queueErrors.set(name, {
      message,
      lastLoggedAt: now,
      suppressedCount: 0,
    });
    this.logger.error(`BullMQ "${name}" queue error: ${message}`);
  }
}
