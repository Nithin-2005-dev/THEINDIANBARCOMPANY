import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditAction, PaymentStatus, Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { AuthUser } from '../common/types/auth-user.type';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
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
  ) {}

  async create(dto: CreatePaymentDto, idempotencyKey?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
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
      throw new BadRequestException('A live payment already exists for this project milestone.');
    }

    return this.idempotencyService.execute({
      key: idempotencyKey,
      scope: `payment:create:${dto.projectId}:${dto.type}`,
      userId: project.clientId,
      request: dto,
      execute: () =>
        this.prisma.payment.create({
          data: {
            ...dto,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
            status: dto.status ?? PaymentStatus.PENDING,
            gateway: dto.gateway ?? 'RAZORPAY',
          },
        }),
    });
  }

  async createOrder(dto: CreatePaymentOrderDto, user: AuthUser, idempotencyKey?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: {
        project: true,
      },
    });

    if (!payment || payment.deletedAt) {
      throw new NotFoundException('Payment not found.');
    }

    if (user.role !== Role.ADMIN && payment.project.clientId !== user.userId) {
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
      ...(user.role === Role.ADMIN ? {} : { project: { clientId: user.userId } }),
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

  async updateStatus(id: string, dto: UpdatePaymentStatusDto) {
    await this.ensurePayment(id);

    return this.prisma.payment.update({
      where: { id },
      data: {
        status: dto.status,
        transactionId: dto.transactionId,
        paidAt: dto.status === PaymentStatus.PAID ? new Date() : null,
      },
      include: {
        project: true,
      },
    });
  }

  async verifyPayment(dto: VerifyPaymentDto, user: AuthUser, idempotencyKey?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: {
        project: true,
      },
    });

    if (!payment || payment.deletedAt) {
      throw new NotFoundException('Payment not found.');
    }

    if (user.role !== Role.ADMIN && payment.project.clientId !== user.userId) {
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

        return updatedPayment;
      },
    });
  }

  async processWebhook(
    rawBody: Buffer,
    signature: string | undefined,
    payload: Record<string, any>,
  ) {
    const isValid = this.razorpayGateway.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    const eventId = payload.payload?.payment?.entity?.id ?? payload.created_at?.toString();
    const orderId = payload.payload?.payment?.entity?.order_id as string | undefined;

    if (!orderId || !eventId) {
      throw new BadRequestException('Webhook payload missing identifiers.');
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        gatewayOrderId: orderId,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment mapping not found for webhook order.');
    }

    if (payment.webhookEventId === eventId || payment.status === PaymentStatus.PAID) {
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

    return { processed: true, payment: updated };
  }

  async getProjectHistory(projectId: string, user: AuthUser) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    if (user.role !== Role.ADMIN && project.clientId !== user.userId) {
      throw new ForbiddenException('You cannot access this payment history.');
    }

    return this.prisma.payment.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
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
}
