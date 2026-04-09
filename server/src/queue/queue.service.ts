import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { JobsOptions, Queue } from 'bullmq';
import {
  AdminEmailDeliveryRecord,
  EmailDeliveryService,
} from '../email/email-delivery.service';
import { EmailQueuePayload } from '../email/email.types';

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
    private readonly emailDeliveryService: EmailDeliveryService,
  ) {
    this.bindQueueErrorLogging('otp', this.otpQueue);
    this.bindQueueErrorLogging('notifications', this.notificationsQueue);
    this.bindQueueErrorLogging('payments', this.paymentsQueue);
    this.bindQueueErrorLogging('vendors', this.vendorsQueue);
    this.bindQueueErrorLogging('reminders', this.remindersQueue);
  }

  async queueOtp(payload: Record<string, unknown>) {
    try {
      const job = await this.otpQueue.add('send-otp', payload);
      return {
        queued: true,
        jobId: job.id?.toString() ?? null,
      };
    } catch (error) {
      this.logger.error(`Unable to queue OTP job: ${String(error)}`);
      return {
        queued: false,
        error: String(error),
      };
    }
  }

  queueNotification(payload: Record<string, unknown>) {
    return this.notificationsQueue.add('notify', payload);
  }

  async queueEmail(payload: EmailQueuePayload) {
    const emailDelivery =
      await this.emailDeliveryService.createQueuedEmail(payload);

    try {
      await this.enqueueEmailAttempt(emailDelivery.id, payload, 1, 0);
    } catch (error) {
      await this.emailDeliveryService.markQueueingFailed(emailDelivery.id, error);
    }

    return this.emailDeliveryService.findForAdmin(emailDelivery.id);
  }

  async enqueueEmailAttempt(
    emailDeliveryId: string,
    payload: EmailQueuePayload,
    attemptNumber: number,
    delayMs = 0,
    options?: {
      replaceExisting?: boolean;
    },
  ) {
    const jobId = this.buildEmailAttemptJobId(emailDeliveryId, attemptNumber);

    if (options?.replaceExisting) {
      const existing = await this.notificationsQueue.getJob(jobId);
      if (existing) {
        await existing.remove();
      }
    }

    return this.notificationsQueue.add(
      'send-email',
      {
        emailDeliveryId,
        email: payload,
        attemptNumber,
      },
      {
        attempts: 1,
        backoff: undefined,
        delay: delayMs,
        jobId,
      },
    );
  }

  async requeueTrackedEmail(
    emailDelivery: Pick<
      AdminEmailDeliveryRecord,
      | 'id'
      | 'toEmail'
      | 'subject'
      | 'template'
      | 'variables'
      | 'emailType'
      | 'metadata'
      | 'recipientUserId'
      | 'requestedById'
      | 'leadId'
      | 'projectId'
      | 'paymentId'
      | 'proposalId'
      | 'contractId'
      | 'allowManualResend'
      | 'isSensitive'
      | 'retryCount'
    >,
    options?: {
      attemptNumber?: number;
      delayMs?: number;
      replaceExisting?: boolean;
    },
  ) {
    const payload: EmailQueuePayload = {
      to: emailDelivery.toEmail,
      subject: emailDelivery.subject,
      template: emailDelivery.template,
      variables:
        (emailDelivery.variables as Record<string, unknown> | null) ?? undefined,
      emailType: emailDelivery.emailType,
      metadata: (emailDelivery.metadata as Prisma.InputJsonValue | null) ?? undefined,
      recipientUserId: emailDelivery.recipientUserId ?? undefined,
      requestedById: emailDelivery.requestedById ?? undefined,
      leadId: emailDelivery.leadId ?? undefined,
      projectId: emailDelivery.projectId ?? undefined,
      paymentId: emailDelivery.paymentId ?? undefined,
      proposalId: emailDelivery.proposalId ?? undefined,
      contractId: emailDelivery.contractId ?? undefined,
      allowManualResend: emailDelivery.allowManualResend,
      isSensitive: emailDelivery.isSensitive,
    };

    const attemptNumber =
      options?.attemptNumber ?? Math.max(emailDelivery.retryCount + 1, 1);

    return this.enqueueEmailAttempt(
      emailDelivery.id,
      payload,
      attemptNumber,
      options?.delayMs ?? 0,
      {
        replaceExisting: options?.replaceExisting,
      },
    );
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

  private buildEmailAttemptJobId(emailDeliveryId: string, attemptNumber: number) {
    return `email-${emailDeliveryId}-attempt-${attemptNumber}`;
  }
}
