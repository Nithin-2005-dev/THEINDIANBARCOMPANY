import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, ProjectTaskStatus } from '@prisma/client';

type OtpDeliveryChannel = 'PHONE' | 'EMAIL';

abstract class LoggedWorkerHost extends WorkerHost {
  protected abstract readonly logger: Logger;

  @OnWorkerEvent('error')
  onWorkerError(error: Error) {
    this.logger.error(`BullMQ worker error: ${String(error)}`);
  }
}

@Processor('otp')
export class OtpProcessor extends LoggedWorkerHost {
  protected readonly logger = new Logger(OtpProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(
    job: Job<{
      channel: OtpDeliveryChannel;
      destination: string;
      message: string;
      subject?: string;
      template?: string;
      variables?: Record<string, unknown>;
    }>,
  ) {
    await this.notificationsService.sendOtp({
      channel: job.data.channel,
      destination: job.data.destination,
      message: job.data.message,
      subject: job.data.subject,
      template: job.data.template,
      variables: job.data.variables,
    });
    this.logger.log(`OTP job processed: ${job.id}`);
  }
}

@Processor('payments')
export class PaymentsProcessor extends LoggedWorkerHost {
  protected readonly logger = new Logger(PaymentsProcessor.name);

  async process(job: Job<Record<string, unknown>>) {
    this.logger.log(`Payments job processed: ${job.name} (${job.id})`);
  }
}

@Processor('vendors')
export class VendorsProcessor extends LoggedWorkerHost {
  protected readonly logger = new Logger(VendorsProcessor.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<Record<string, unknown>>) {
    if (job.name === 'vendor-alert' && job.data.vendorUserId) {
      await this.notificationsService.createInApp({
        userId: String(job.data.vendorUserId),
        type: 'STATUS',
        title: String(job.data.title ?? 'Vendor update'),
        body: String(job.data.body ?? 'You have a new vendor assignment.'),
        actionUrl: String(job.data.actionUrl ?? '/vendor'),
        metadata: {
          projectId: String(job.data.projectId ?? ''),
          vendorId: String(job.data.vendorId ?? ''),
        },
      });

      const vendor = await this.prisma.user.findUnique({
        where: { id: String(job.data.vendorUserId) },
        select: { email: true },
      });

      if (vendor?.email) {
        await this.notificationsService.sendEmail({
          to: vendor.email,
          subject: String(job.data.title ?? 'New vendor assignment'),
          template: 'project-update',
          variables: {
            title: job.data.title ?? 'New vendor assignment',
            body: job.data.body ?? 'You have a new project assignment.',
          },
        });
      }
    }

    this.logger.log(`Vendor alert processed: ${job.id}`);
  }
}

@Processor('reminders')
export class RemindersProcessor extends LoggedWorkerHost {
  protected readonly logger = new Logger(RemindersProcessor.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<Record<string, unknown>>) {
    switch (job.data.kind) {
      case 'task-due-soon':
        await this.handleTaskReminder(String(job.data.taskId), false);
        break;
      case 'task-overdue':
        await this.handleTaskReminder(String(job.data.taskId), true);
        break;
      case 'payment-due':
        await this.handlePaymentReminder(String(job.data.paymentId), false);
        break;
      case 'payment-overdue':
        await this.handlePaymentReminder(String(job.data.paymentId), true);
        break;
      case 'event-countdown':
        await this.handleEventReminder(
          String(job.data.projectId),
          Number(job.data.daysRemaining ?? 0),
        );
        break;
      default:
        break;
    }

    this.logger.log(`Reminder processed: ${job.id}`);
  }

  private async handleTaskReminder(taskId: string, overdue: boolean) {
    const task = await this.prisma.projectTask.findUnique({
      where: { id: taskId },
      include: {
        assignedVendor: true,
        project: {
          include: {
            assignments: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!task || task.deletedAt || task.status === ProjectTaskStatus.DONE) {
      return;
    }

    const recipients = new Set<string>();
    if (task.assignedUserId) {
      recipients.add(task.assignedUserId);
    }
    if (task.assignedVendor?.userId) {
      recipients.add(task.assignedVendor.userId);
    }
    for (const assignment of task.project.assignments) {
      recipients.add(assignment.userId);
    }

    await Promise.all(
      [...recipients].map((userId) =>
        this.notificationsService.createInApp({
          userId,
          type: 'STATUS',
          title: overdue ? 'Task overdue' : 'Task deadline approaching',
          body: overdue
            ? `${task.title} is now overdue and needs attention.`
            : `${task.title} is due within 24 hours.`,
          actionUrl:
            userId === task.assignedVendor?.userId
              ? `/vendor/projects/${task.projectId}`
              : `/staff/projects/${task.projectId}`,
          metadata: {
            taskId: task.id,
            projectId: task.projectId,
            overdue,
          },
        }),
      ),
    );
  }

  private async handlePaymentReminder(paymentId: string, overdue: boolean) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        project: {
          include: {
            client: true,
            assignments: {
              where: { isActive: true },
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

    if (
      !payment ||
      payment.deletedAt ||
      payment.status !== PaymentStatus.PENDING
    ) {
      return;
    }

    const leadId = payment.project.contract.proposal.leadId;

    await this.notificationsService.createInApp({
      userId: payment.project.clientId,
      type: 'PAYMENT',
      title: overdue ? 'Payment overdue' : 'Payment due soon',
      body: overdue
        ? `${payment.type} payment is overdue. Please review the outstanding balance.`
        : `${payment.type} payment is due soon for your event.`,
      actionUrl: `/dashboard/events/${leadId}`,
      metadata: {
        paymentId: payment.id,
        projectId: payment.projectId,
        overdue,
      },
    });

    await Promise.all(
      payment.project.assignments.map((assignment) =>
        this.notificationsService.createInApp({
          userId: assignment.userId,
          type: 'PAYMENT',
          title: overdue ? 'Client payment overdue' : 'Upcoming client payment',
          body: `${payment.type} milestone for ${payment.project.contract.proposal.title} ${
            overdue ? 'is overdue' : 'is due soon'
          }.`,
          actionUrl: `/staff/projects/${payment.projectId}`,
          metadata: {
            paymentId: payment.id,
            projectId: payment.projectId,
            overdue,
          },
        }),
      ),
    );

    if (payment.project.client.email) {
      await this.notificationsService.sendEmail({
        to: payment.project.client.email,
        subject: overdue ? 'Payment overdue' : 'Payment reminder',
        template: 'payment-reminder',
        variables: {
          paymentType: payment.type.toLowerCase(),
          amount: `${payment.currency} ${payment.amount}`,
          dueDate: payment.dueDate?.toISOString().slice(0, 10),
        },
      });
    }
  }

  private async handleEventReminder(projectId: string, daysRemaining: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: true,
        assignments: {
          where: { isActive: true },
        },
        vendors: {
          include: {
            vendor: true,
          },
        },
        contract: {
          include: {
            proposal: {
              include: {
                lead: true,
              },
            },
          },
        },
      },
    });

    if (!project || project.deletedAt) {
      return;
    }

    const title =
      daysRemaining > 0
        ? `Event in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`
        : 'Event reminder';
    const body = `${project.contract.proposal.title} at ${project.contract.proposal.lead.location} is approaching.`;
    const recipientIds = new Set<string>([
      project.clientId,
      ...project.assignments.map((assignment) => assignment.userId),
      ...project.vendors
        .map((assignment) => assignment.vendor.userId)
        .filter((userId): userId is string => Boolean(userId)),
    ]);

    await Promise.all(
      [...recipientIds].map((userId) =>
        this.notificationsService.createInApp({
          userId,
          type: 'EVENT',
          title,
          body,
          actionUrl:
            userId === project.clientId
              ? `/dashboard/events/${project.contract.proposal.leadId}`
              : project.vendors.some(
                    (assignment) => assignment.vendor.userId === userId,
                  )
                ? `/vendor/projects/${project.id}`
                : `/staff/projects/${project.id}`,
          metadata: {
            projectId: project.id,
            daysRemaining,
          },
        }),
      ),
    );

    if (project.client.email) {
      await this.notificationsService.sendEmail({
        to: project.client.email,
        subject: title,
        template: 'event-reminder',
        variables: {
          title: project.contract.proposal.title,
          eventDate: project.contract.proposal.lead.eventDate
            .toISOString()
            .slice(0, 10),
          location: project.contract.proposal.lead.location,
        },
      });
    }
  }
}

@Processor('notifications')
export class NotificationsProcessor extends LoggedWorkerHost {
  protected readonly logger = new Logger(NotificationsProcessor.name);

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
