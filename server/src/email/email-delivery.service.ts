import { Injectable, NotFoundException } from '@nestjs/common';
import {
  EmailDeliveryLogEvent,
  EmailDeliveryStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  EMAIL_MAX_RETRIES,
  EmailDispatchResult,
  EmailQueuePayload,
  containsSensitiveEmailVariables,
  inferEmailType,
  redactEmailVariables,
} from './email.types';

const adminEmailDeliverySelect = {
  id: true,
  status: true,
  emailType: true,
  template: true,
  subject: true,
  toEmail: true,
  provider: true,
  providerMessageId: true,
  providerAcknowledgedAt: true,
  providerResponse: true,
  variables: true,
  metadata: true,
  recipientUserId: true,
  requestedById: true,
  leadId: true,
  projectId: true,
  paymentId: true,
  proposalId: true,
  contractId: true,
  retryCount: true,
  maxRetries: true,
  lastRetryAt: true,
  nextRetryAt: true,
  processingStartedAt: true,
  sentAt: true,
  failedAt: true,
  lastErrorMessage: true,
  lastErrorAt: true,
  allowManualResend: true,
  isSensitive: true,
  createdAt: true,
  updatedAt: true,
  recipientUser: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    },
  },
  requestedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    },
  },
  logs: {
    orderBy: { createdAt: 'desc' },
    take: 20,
  },
} satisfies Prisma.EmailDeliverySelect;

export type AdminEmailDeliveryRecord = Prisma.EmailDeliveryGetPayload<{
  select: typeof adminEmailDeliverySelect;
}>;

@Injectable()
export class EmailDeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async createQueuedEmail(payload: EmailQueuePayload) {
    const normalized = this.normalizePayload(payload);

    const emailDelivery = await this.prisma.emailDelivery.create({
      data: {
        emailType: normalized.emailType,
        template: normalized.template,
        subject: normalized.subject,
        toEmail: normalized.toEmail,
        variables: normalized.variables,
        metadata: normalized.metadata,
        recipientUserId: normalized.recipientUserId,
        requestedById: normalized.requestedById,
        leadId: normalized.leadId,
        projectId: normalized.projectId,
        paymentId: normalized.paymentId,
        proposalId: normalized.proposalId,
        contractId: normalized.contractId,
        allowManualResend: normalized.allowManualResend,
        isSensitive: normalized.isSensitive,
        maxRetries: EMAIL_MAX_RETRIES,
      },
    });

    await this.logEvent(emailDelivery.id, EmailDeliveryLogEvent.QUEUED, {
      message: `Email queued for ${normalized.toEmail}.`,
      details: {
        emailType: normalized.emailType,
        template: normalized.template,
      },
    });

    return emailDelivery;
  }

  async markQueueingFailed(emailDeliveryId: string, error: unknown) {
    const message = this.toErrorMessage(error);

    await this.prisma.emailDelivery.update({
      where: { id: emailDeliveryId },
      data: {
        status: EmailDeliveryStatus.FAILED,
        failedAt: new Date(),
        nextRetryAt: null,
        lastErrorMessage: message,
        lastErrorAt: new Date(),
      },
    });

    await this.logEvent(emailDeliveryId, EmailDeliveryLogEvent.QUEUEING_FAILED, {
      message,
    });
  }

  async markProcessing(
    emailDeliveryId: string,
    attemptNumber: number,
    jobId?: string,
  ) {
    await this.prisma.emailDelivery.update({
      where: { id: emailDeliveryId },
      data: {
        status: EmailDeliveryStatus.PROCESSING,
        processingStartedAt: new Date(),
        nextRetryAt: null,
      },
    });

    await this.logEvent(emailDeliveryId, EmailDeliveryLogEvent.PROCESSING, {
      attemptNumber,
      jobId,
      message: `Delivery attempt ${attemptNumber} started.`,
    });
  }

  async markRetryScheduled(params: {
    emailDeliveryId: string;
    attemptNumber: number;
    nextRetryAt: Date;
    error: unknown;
    jobId?: string;
  }) {
    const message = this.toErrorMessage(params.error);

    await this.prisma.emailDelivery.update({
      where: { id: params.emailDeliveryId },
      data: {
        status: EmailDeliveryStatus.RETRYING,
        retryCount: Math.min(params.attemptNumber, EMAIL_MAX_RETRIES),
        lastRetryAt: new Date(),
        nextRetryAt: params.nextRetryAt,
        lastErrorMessage: message,
        lastErrorAt: new Date(),
      },
    });

    await this.logEvent(
      params.emailDeliveryId,
      EmailDeliveryLogEvent.RETRY_SCHEDULED,
      {
        attemptNumber: params.attemptNumber,
        jobId: params.jobId,
        message: `${message} Retrying at ${params.nextRetryAt.toISOString()}.`,
        details: {
          nextRetryAt: params.nextRetryAt.toISOString(),
        },
      },
    );
  }

  async markSent(params: {
    emailDeliveryId: string;
    attemptNumber: number;
    result: EmailDispatchResult;
    jobId?: string;
  }) {
    await this.prisma.emailDelivery.update({
      where: { id: params.emailDeliveryId },
      data: {
        status: EmailDeliveryStatus.SENT,
        provider: params.result.provider,
        providerMessageId: params.result.providerMessageId ?? null,
        providerAcknowledgedAt: params.result.providerAcknowledgedAt ?? null,
        providerResponse: params.result.providerResponse ?? undefined,
        sentAt: new Date(),
        nextRetryAt: null,
        failedAt: null,
        lastErrorMessage: null,
        lastErrorAt: null,
      },
    });

    await this.logEvent(params.emailDeliveryId, EmailDeliveryLogEvent.SENT, {
      attemptNumber: params.attemptNumber,
      jobId: params.jobId,
      message: `Email acknowledged by ${params.result.provider}.`,
      details: {
        provider: params.result.provider,
        providerMessageId: params.result.providerMessageId ?? null,
        providerAcknowledgedAt:
          params.result.providerAcknowledgedAt?.toISOString() ?? null,
      },
    });
  }

  async markFailed(params: {
    emailDeliveryId: string;
    attemptNumber: number;
    error: unknown;
    jobId?: string;
  }) {
    const message = this.toErrorMessage(params.error);

    await this.prisma.emailDelivery.update({
      where: { id: params.emailDeliveryId },
      data: {
        status: EmailDeliveryStatus.FAILED,
        failedAt: new Date(),
        nextRetryAt: null,
        lastErrorMessage: message,
        lastErrorAt: new Date(),
      },
    });

    await this.logEvent(params.emailDeliveryId, EmailDeliveryLogEvent.FAILED, {
      attemptNumber: params.attemptNumber,
      jobId: params.jobId,
      message,
    });
  }

  async prepareManualResend(
    emailDeliveryId: string,
    requestedById?: string,
    forceSend = false,
  ) {
    const current = await this.findByIdOrThrow(emailDeliveryId);

    await this.prisma.emailDelivery.update({
      where: { id: emailDeliveryId },
      data: {
        status: EmailDeliveryStatus.QUEUED,
        retryCount: forceSend && current.status !== EmailDeliveryStatus.FAILED
          ? current.retryCount
          : 0,
        nextRetryAt: null,
        failedAt: forceSend && current.status !== EmailDeliveryStatus.FAILED
          ? current.failedAt
          : null,
        lastErrorMessage:
          forceSend && current.status !== EmailDeliveryStatus.FAILED
            ? current.lastErrorMessage
            : null,
        lastErrorAt:
          forceSend && current.status !== EmailDeliveryStatus.FAILED
            ? current.lastErrorAt
            : null,
        requestedById: requestedById ?? current.requestedById,
      },
    });

    await this.logEvent(
      emailDeliveryId,
      forceSend
        ? EmailDeliveryLogEvent.FORCE_SEND_REQUESTED
        : EmailDeliveryLogEvent.RESEND_REQUESTED,
      {
        message: forceSend
          ? 'Admin requested an immediate send.'
          : 'Admin requested a resend.',
        details: requestedById
          ? {
              requestedById,
            }
          : undefined,
      },
    );

    return this.findByIdOrThrow(emailDeliveryId);
  }

  async listForAdmin(query: {
    page?: number;
    limit?: number;
    status?: string;
    emailType?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildAdminWhere(query);

    const [items, total, counts, distinctTypes] = await Promise.all([
      this.prisma.emailDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: adminEmailDeliverySelect,
      }),
      this.prisma.emailDelivery.count({ where }),
      this.prisma.emailDelivery.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: this.buildAdminWhere({
          emailType: query.emailType,
          search: query.search,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        }),
      }),
      this.prisma.emailDelivery.findMany({
        where: {
          ...(query.search?.trim()
            ? this.buildAdminWhere({
                search: query.search,
                dateFrom: query.dateFrom,
                dateTo: query.dateTo,
              })
            : this.buildAdminWhere({
                dateFrom: query.dateFrom,
                dateTo: query.dateTo,
              })),
        },
        distinct: ['emailType'],
        select: {
          emailType: true,
        },
        orderBy: {
          emailType: 'asc',
        },
      }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
      },
      summary: {
        total,
        queued: this.getCountForStatus(counts, EmailDeliveryStatus.QUEUED),
        processing: this.getCountForStatus(
          counts,
          EmailDeliveryStatus.PROCESSING,
        ),
        retrying: this.getCountForStatus(
          counts,
          EmailDeliveryStatus.RETRYING,
        ),
        sent: this.getCountForStatus(counts, EmailDeliveryStatus.SENT),
        failed: this.getCountForStatus(counts, EmailDeliveryStatus.FAILED),
      },
      emailTypes: distinctTypes
        .map((item) => item.emailType)
        .filter((value) => Boolean(value)),
    };
  }

  async findForAdmin(emailDeliveryId: string) {
    return this.findByIdOrThrow(emailDeliveryId);
  }

  async findByIdOrThrow(emailDeliveryId: string) {
    const emailDelivery = await this.prisma.emailDelivery.findUnique({
      where: { id: emailDeliveryId },
      select: adminEmailDeliverySelect,
    });

    if (!emailDelivery) {
      throw new NotFoundException('Email delivery record not found.');
    }

    return emailDelivery;
  }

  private async logEvent(
    emailDeliveryId: string,
    event: EmailDeliveryLogEvent,
    input?: {
      attemptNumber?: number;
      jobId?: string;
      message?: string;
      details?: Prisma.InputJsonValue;
    },
  ) {
    await this.prisma.emailDeliveryLog.create({
      data: {
        emailDeliveryId,
        event,
        attemptNumber: input?.attemptNumber,
        jobId: input?.jobId,
        message: input?.message,
        details: input?.details,
      },
    });
  }

  private normalizePayload(payload: EmailQueuePayload) {
    const template = payload.template.trim();
    const toEmail = payload.to.trim().toLowerCase();
    const emailType = inferEmailType(template, payload.emailType);
    const detectedSensitivity =
      payload.isSensitive ?? containsSensitiveEmailVariables(payload.variables);
    const allowManualResend =
      payload.allowManualResend ?? !detectedSensitivity;

    return {
      toEmail,
      subject: payload.subject.trim(),
      template,
      emailType,
      variables: payload.variables
        ? (redactEmailVariables(payload.variables) as Prisma.InputJsonValue)
        : undefined,
      metadata: payload.metadata,
      recipientUserId: payload.recipientUserId,
      requestedById: payload.requestedById,
      leadId: payload.leadId,
      projectId: payload.projectId,
      paymentId: payload.paymentId,
      proposalId: payload.proposalId,
      contractId: payload.contractId,
      allowManualResend,
      isSensitive: detectedSensitivity,
    };
  }

  private buildAdminWhere(query: {
    status?: string;
    emailType?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Prisma.EmailDeliveryWhereInput {
    const search = query.search?.trim();
    const emailType = query.emailType?.trim();

    return {
      ...(query.status ? this.mapStatusFilter(query.status) : {}),
      ...(emailType ? { emailType } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { toEmail: { contains: search, mode: 'insensitive' } },
              { subject: { contains: search, mode: 'insensitive' } },
              { template: { contains: search, mode: 'insensitive' } },
              { emailType: { contains: search, mode: 'insensitive' } },
              { provider: { contains: search, mode: 'insensitive' } },
              { providerMessageId: { contains: search, mode: 'insensitive' } },
              { leadId: { contains: search, mode: 'insensitive' } },
              { projectId: { contains: search, mode: 'insensitive' } },
              { paymentId: { contains: search, mode: 'insensitive' } },
              { proposalId: { contains: search, mode: 'insensitive' } },
              { contractId: { contains: search, mode: 'insensitive' } },
              {
                recipientUser: {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };
  }

  private mapStatusFilter(status: string): Prisma.EmailDeliveryWhereInput {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return {
          status: {
            in: [EmailDeliveryStatus.QUEUED, EmailDeliveryStatus.PROCESSING],
          },
        };
      case 'QUEUED':
        return {
          status: EmailDeliveryStatus.QUEUED,
        };
      case 'PROCESSING':
        return {
          status: EmailDeliveryStatus.PROCESSING,
        };
      case 'RETRYING':
        return {
          status: EmailDeliveryStatus.RETRYING,
        };
      case 'SENT':
        return {
          status: EmailDeliveryStatus.SENT,
        };
      case 'FAILED':
        return {
          status: EmailDeliveryStatus.FAILED,
        };
      default:
        return {};
    }
  }

  private getCountForStatus(
    counts: Array<{ status: EmailDeliveryStatus; _count: { _all: number } }>,
    status: EmailDeliveryStatus,
  ) {
    return counts.find((item) => item.status === status)?._count._all ?? 0;
  }

  private toErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
