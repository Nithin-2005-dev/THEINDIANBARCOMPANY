import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditAction, PaymentStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { LeadsService } from '../leads/leads.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { AuthUser } from '../common/types/auth-user.type';
import { isAdminRole, isStaffRole } from '../common/auth/role-helpers';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { RazorpayGateway } from './gateway/razorpay.gateway';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayGateway: RazorpayGateway,
    private readonly auditService: AuditService,
    private readonly queueService: QueueService,
    private readonly idempotencyService: IdempotencyService,
    private readonly leadsService: LeadsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    dto: CreatePaymentDto,
    actorId?: string,
    idempotencyKey?: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      include: {
        contract: {
          include: {
            proposal: {
              include: {
                lead: {
                  include: {
                    client: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    const duplicateMilestone = await this.prisma.payment.findFirst({
      where: {
        projectId: dto.projectId,
        type: dto.type,
        deletedAt: null,
        status: {
          in: [PaymentStatus.PENDING, PaymentStatus.PAID],
        },
      },
    });

    if (duplicateMilestone) {
      throw new BadRequestException(
        'A live payment already exists for this project milestone.',
      );
    }

    return this.idempotencyService.execute({
      key: idempotencyKey,
      scope: `payment:create:${dto.projectId}:${dto.type}`,
      userId: project.clientId,
      request: dto,
      execute: () =>
        this.prisma.payment
          .create({
            data: {
              ...dto,
              dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
              status: dto.status ?? PaymentStatus.PENDING,
              gateway: dto.gateway ?? 'RAZORPAY',
            },
          })
          .then(async (payment) => {
            const leadId = project.contract?.proposal.leadId;
            if (leadId) {
              await this.leadsService.recordPaymentCreated(
                leadId,
                actorId,
                payment.id,
              );
              await this.notificationsService.createInApp({
                userId: project.clientId,
                type: 'PAYMENT',
                title: 'Payment scheduled',
                body: `${payment.type} payment of ${payment.currency} ${payment.amount} is now available for payment.`,
                actionUrl: `/dashboard/events/${leadId}`,
                metadata: {
                  paymentId: payment.id,
                  leadId,
                  projectId: project.id,
                },
              });

              const clientEmail = project.contract?.proposal.lead.client.email;
              if (clientEmail) {
                await this.queueService.queueEmail({
                  to: clientEmail,
                  subject: `${payment.type} payment scheduled`,
                  template: 'payment-reminder',
                  variables: {
                    paymentType: payment.type.toLowerCase(),
                    amount: `${payment.currency} ${payment.amount}`,
                    dueDate: payment.dueDate?.toISOString().slice(0, 10),
                  },
                });
              }
            }

            if (payment.dueDate && payment.status === PaymentStatus.PENDING) {
              const dueAt = payment.dueDate.getTime();
              const now = Date.now();
              const reminderAt = dueAt - 24 * 60 * 60 * 1000;

              if (reminderAt > now) {
                await this.queueService.queueReminder(
                  {
                    kind: 'payment-due',
                    paymentId: payment.id,
                  },
                  {
                    delay: reminderAt - now,
                    jobId: `payment-due:${payment.id}:${payment.dueDate.toISOString()}`,
                  },
                );
              }

              if (dueAt > now) {
                await this.queueService.queueReminder(
                  {
                    kind: 'payment-overdue',
                    paymentId: payment.id,
                  },
                  {
                    delay: dueAt - now,
                    jobId: `payment-overdue:${payment.id}:${payment.dueDate.toISOString()}`,
                  },
                );
              }
            }

            return payment;
          }),
    });
  }

  async createOrder(
    dto: CreatePaymentOrderDto,
    user: AuthUser,
    idempotencyKey?: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: {
        project: true,
      },
    });

    if (!payment || payment.deletedAt) {
      throw new NotFoundException('Payment not found.');
    }

    if (!isAdminRole(user.role) && payment.project.clientId !== user.userId) {
      throw new ForbiddenException('You cannot initiate this payment.');
    }

    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException('Payment already completed.');
    }

    if (payment.gatewayOrderId) {
      return payment;
    }

    return this.idempotencyService.execute({
      key: idempotencyKey,
      scope: `payment:create-order:${payment.id}`,
      userId: user.userId,
      request: dto,
      execute: async () => {
        const order = await this.razorpayGateway.createOrder({
          amount: payment.amount,
          currency: payment.currency,
          receipt: dto.receipt ?? payment.id,
          notes: {
            paymentId: payment.id,
            projectId: payment.projectId,
          },
        });

        const updated = await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            gatewayOrderId: order.id,
            gatewayMetadata: order as Prisma.InputJsonValue,
          },
        });

        await this.auditService.log({
          action: AuditAction.PAYMENT_ORDER_CREATED,
          entityType: 'Payment',
          entityId: payment.id,
          userId: user.userId,
          metadata: order as Prisma.InputJsonValue,
        });

        return updated;
      },
    });
  }

  async listForUser(user: AuthUser, query: ListPaymentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.PaymentWhereInput = {
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      deletedAt: null,
      ...(isStaffRole(user.role) ? {} : { project: { clientId: user.userId } }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          project: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total },
    };
  }

  async updateStatus(
    id: string,
    dto: UpdatePaymentStatusDto,
    actorId?: string,
  ) {
    const payment = await this.ensurePayment(id);

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: dto.status,
        transactionId: dto.transactionId,
        paidAt: dto.status === PaymentStatus.PAID ? new Date() : null,
        receiptUrl:
          dto.status === PaymentStatus.PAID
            ? `/dashboard/receipts/${id}`
            : null,
      },
      include: {
        project: true,
      },
    });

    const leadId = await this.getLeadIdForProject(payment.projectId);
    if (leadId) {
      await this.leadsService.recordPaymentUpdated(
        leadId,
        actorId,
        id,
        dto.status,
      );
      await this.notificationsService.createInApp({
        userId: updated.project.clientId,
        type: 'PAYMENT',
        title: `Payment ${dto.status.toLowerCase()}`,
        body: `Your ${updated.type.toLowerCase()} milestone is now ${dto.status.toLowerCase()}.`,
        actionUrl: `/dashboard/events/${leadId}`,
        metadata: {
          paymentId: updated.id,
          leadId,
          status: dto.status,
        },
      });

      const project = await this.prisma.project.findUnique({
        where: { id: updated.projectId },
        include: {
          client: {
            select: {
              email: true,
            },
          },
        },
      });

      if (project?.client.email && dto.status === PaymentStatus.PAID) {
        await this.queueService.queueEmail({
          to: project.client.email,
          subject: 'Payment received',
          template: 'payment-receipt',
          variables: {
            paymentType: updated.type.toLowerCase(),
            amount: `${updated.currency} ${updated.amount}`,
            receiptUrl: updated.receiptUrl,
          },
        });
      }
    }

    return updated;
  }

  async verifyPayment(
    dto: VerifyPaymentDto,
    user: AuthUser,
    idempotencyKey?: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: {
        project: true,
      },
    });

    if (!payment || payment.deletedAt) {
      throw new NotFoundException('Payment not found.');
    }

    if (!isAdminRole(user.role) && payment.project.clientId !== user.userId) {
      throw new ForbiddenException('You cannot verify this payment.');
    }

    if (payment.status === PaymentStatus.PAID) {
      return payment;
    }

    const isValid = this.razorpayGateway.verifyPaymentSignature(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid payment signature.');
    }

    return this.idempotencyService.execute({
      key: idempotencyKey ?? dto.razorpayPaymentId,
      scope: `payment:verify:${payment.id}`,
      userId: user.userId,
      request: dto,
      execute: async () => {
        const updatedPayment = await this.prisma.$transaction(async (tx) => {
          return tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.PAID,
              gatewayOrderId: dto.razorpayOrderId,
              transactionId: dto.razorpayPaymentId,
              gatewaySignature: dto.razorpaySignature,
              paidAt: new Date(),
              receiptUrl: `/dashboard/receipts/${payment.id}`,
            },
          });
        });

        await this.auditService.log({
          action: AuditAction.PAYMENT_CAPTURED,
          entityType: 'Payment',
          entityId: payment.id,
          userId: user.userId,
          metadata: dto as unknown as Prisma.InputJsonValue,
        });
        await this.queueService.queuePaymentJob('payment-captured', {
          paymentId: payment.id,
          projectId: payment.projectId,
          idempotencyKey: dto.razorpayPaymentId,
        });
        const leadId = await this.getLeadIdForProject(payment.projectId);
        if (leadId) {
          await this.leadsService.recordPaymentUpdated(
            leadId,
            user.userId,
            payment.id,
            PaymentStatus.PAID,
          );
          await this.notificationsService.createInApp({
            userId: payment.project.clientId,
            type: 'PAYMENT',
            title: 'Payment received',
            body: `We received your ${payment.type.toLowerCase()} payment successfully.`,
            actionUrl: `/dashboard/events/${leadId}`,
            metadata: {
              paymentId: payment.id,
              leadId,
              status: PaymentStatus.PAID,
            },
          });

          const client = await this.prisma.user.findUnique({
            where: { id: payment.project.clientId },
            select: { email: true },
          });

          if (client?.email) {
            await this.queueService.queueEmail({
              to: client.email,
              subject: 'Payment received',
              template: 'payment-receipt',
              variables: {
                paymentType: payment.type.toLowerCase(),
                amount: `${payment.currency} ${payment.amount}`,
                receiptUrl: `/dashboard/receipts/${payment.id}`,
              },
            });
          }
        }

        return updatedPayment;
      },
    });
  }

  async processWebhook(
    rawBody: Buffer,
    signature: string | undefined,
    payload: Record<string, any>,
  ) {
    const isValid = this.razorpayGateway.verifyWebhookSignature(
      rawBody,
      signature,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    const eventId =
      payload.payload?.payment?.entity?.id ?? payload.created_at?.toString();
    const orderId = payload.payload?.payment?.entity?.order_id as
      | string
      | undefined;

    if (!orderId || !eventId) {
      throw new BadRequestException('Webhook payload missing identifiers.');
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        gatewayOrderId: orderId,
      },
    });

    if (!payment) {
      throw new NotFoundException(
        'Payment mapping not found for webhook order.',
      );
    }

    if (
      payment.webhookEventId === eventId ||
      payment.status === PaymentStatus.PAID
    ) {
      return { processed: true, duplicate: true };
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        transactionId: payload.payload.payment.entity.id,
        gatewaySignature: signature,
        webhookEventId: eventId,
        gatewayMetadata: payload as Prisma.InputJsonValue,
        paidAt: new Date(),
        receiptUrl: `/dashboard/receipts/${payment.id}`,
      },
    });

    await this.auditService.log({
      action: AuditAction.PAYMENT_WEBHOOK_PROCESSED,
      entityType: 'Payment',
      entityId: payment.id,
      metadata: {
        eventId,
        orderId,
      },
    });

    const project = await this.prisma.project.findUnique({
      where: { id: payment.projectId },
    });
    const leadId = project
      ? await this.getLeadIdForProject(payment.projectId)
      : null;
    if (leadId && project) {
      await this.leadsService.recordPaymentUpdated(
        leadId,
        undefined,
        payment.id,
        PaymentStatus.PAID,
      );
      await this.notificationsService.createInApp({
        userId: project.clientId,
        type: 'PAYMENT',
        title: 'Payment received',
        body: 'A payment has been captured for your event.',
        actionUrl: `/dashboard/events/${leadId}`,
        metadata: {
          paymentId: payment.id,
          leadId,
          status: PaymentStatus.PAID,
        },
      });
    }

    return { processed: true, payment: updated };
  }

  async getProjectHistory(projectId: string, user: AuthUser) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    if (!isAdminRole(user.role) && project.clientId !== user.userId) {
      throw new ForbiddenException('You cannot access this payment history.');
    }

    return this.prisma.payment.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async refundPayment(id: string, dto: RefundPaymentDto, user: AuthUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            client: {
              select: {
                email: true,
              },
            },
            contract: {
              include: {
                proposal: true,
              },
            },
          },
        },
      },
    });

    if (!payment || payment.deletedAt) {
      throw new NotFoundException('Payment not found.');
    }

    if (payment.status !== PaymentStatus.PAID || !payment.transactionId) {
      throw new BadRequestException('Only captured payments can be refunded.');
    }

    const refund = await this.razorpayGateway.refundPayment({
      paymentId: payment.transactionId,
      amount: dto.amount,
      notes: dto.reason
        ? {
            reason: dto.reason,
          }
        : undefined,
    });

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.REFUNDED,
        notes: dto.reason
          ? `${payment.notes ? `${payment.notes}\n` : ''}Refunded: ${dto.reason}`
          : payment.notes,
        gatewayMetadata: {
          ...(payment.gatewayMetadata as Record<string, unknown> | null),
          refund,
        } as Prisma.InputJsonValue,
      },
    });

    await this.auditService.log({
      action: AuditAction.PAYMENT_CAPTURED,
      entityType: 'PaymentRefund',
      entityId: id,
      userId: user.userId,
      metadata: refund as unknown as Prisma.InputJsonValue,
    });

    await this.notificationsService.createInApp({
      userId: payment.project.clientId,
      type: 'PAYMENT',
      title: 'Payment refunded',
      body: `${payment.type} payment has been refunded.`,
      actionUrl: `/dashboard/events/${payment.project.contract.proposal.leadId}`,
      metadata: {
        paymentId: payment.id,
        refundId: refund.id,
      },
    });

    if (payment.project.client.email) {
      await this.queueService.queueEmail({
        to: payment.project.client.email,
        subject: 'Payment refunded',
        template: 'payment-receipt',
        variables: {
          paymentType: payment.type.toLowerCase(),
          amount: `${payment.currency} ${dto.amount ?? payment.amount}`,
          receiptUrl: updated.receiptUrl,
        },
      });
    }

    return updated;
  }

  private async ensurePayment(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }

    return payment;
  }

  private async getLeadIdForProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        contract: {
          include: {
            proposal: true,
          },
        },
      },
    });

    return project?.contract?.proposal?.leadId;
  }
}
