import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma, ProjectStage, Role } from '@prisma/client';
import type { AuthUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendorStatusUpdateDto } from './dto/create-vendor-status-update.dto';

const vendorProjectInclude = Prisma.validator<Prisma.ProjectInclude>()({
  contract: {
    include: {
      proposal: {
        include: {
          lead: true,
        },
      },
    },
  },
  tasks: {
    where: {
      deletedAt: null,
    },
    include: {
      attachments: true,
      comments: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      activities: {
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
  },
  updates: {
    orderBy: { createdAt: 'desc' },
  },
  documents: {
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          isActive: true,
        },
      },
    },
  },
  assignments: {
    where: { isActive: true },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          isActive: true,
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  },
  payments: {
    where: { deletedAt: null },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  },
});

@Injectable()
export class VendorPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getDashboard(user: AuthUser) {
    const vendor = await this.getVendorForUser(user.userId);
    const [projects, notifications] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          deletedAt: null,
          vendors: {
            some: {
              vendorId: vendor.id,
            },
          },
        },
        include: this.getProjectInclude(),
        orderBy: { updatedAt: 'desc' },
      }),
      this.notificationsService.listForUser(user.userId, 20),
    ]);

    return {
      vendor: {
        id: vendor.id,
        name: vendor.name,
        serviceType: vendor.serviceType,
        phone: vendor.phone,
        email: vendor.email,
      },
      summary: {
        assignedProjects: projects.length,
        openTasks: projects.reduce(
          (sum, project) =>
            sum + project.tasks.filter((task) => task.status !== 'DONE').length,
          0,
        ),
        completedTasks: projects.reduce(
          (sum, project) =>
            sum + project.tasks.filter((task) => task.status === 'DONE').length,
          0,
        ),
      },
      projects: projects.map((project) => ({
        id: project.id,
        title: project.contract.proposal.title,
        eventType: project.contract.proposal.lead.eventType,
        location: project.contract.proposal.lead.location,
        eventDate: project.contract.proposal.lead.eventDate,
        status: project.status,
        progress: project.progress,
        openTasks: project.tasks.filter((task) => task.status !== 'DONE')
          .length,
        paymentSummary: {
          paid: project.payments
            .filter((payment) => payment.status === 'PAID')
            .reduce((sum, payment) => sum + payment.amount, 0),
          outstanding: project.payments
            .filter(
              (payment) =>
                payment.status !== 'PAID' && payment.status !== 'REFUNDED',
            )
            .reduce((sum, payment) => sum + payment.amount, 0),
        },
      })),
      notifications,
    };
  }

  async getProject(projectId: string, user: AuthUser) {
    const vendor = await this.getVendorForUser(user.userId);
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        vendors: {
          some: {
            vendorId: vendor.id,
          },
        },
      },
      include: this.getProjectInclude(),
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    const primaryOps =
      project.assignments.find((assignment) => assignment.role === 'PRIMARY')
        ?.user ?? null;

    return {
      project: {
        id: project.id,
        status: project.status,
        progress: project.progress,
        summary: project.summary,
      },
      event: {
        leadId: project.contract.proposal.lead.id,
        title: project.contract.proposal.title,
        eventType: project.contract.proposal.lead.eventType,
        location: project.contract.proposal.lead.location,
        city: project.contract.proposal.lead.city,
        eventDate: project.contract.proposal.lead.eventDate,
        notes: project.contract.proposal.lead.notes,
      },
      opsContact: primaryOps,
      tasks: project.tasks.filter(
        (task) => task.assignedVendorId === vendor.id,
      ),
      updates: project.updates,
      documents: project.documents.filter(
        (document) =>
          !['INTERNAL', 'FINANCE'].includes(document.category.toUpperCase()),
      ),
      payments: project.payments,
    };
  }

  async createStatusUpdate(
    projectId: string,
    dto: CreateVendorStatusUpdateDto,
    user: AuthUser,
  ) {
    const vendor = await this.getVendorForUser(user.userId);
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        vendors: {
          some: {
            vendorId: vendor.id,
          },
        },
      },
      include: {
        assignments: {
          where: { isActive: true },
          include: {
            user: {
              select: this.getUserSummarySelect(),
            },
          },
        },
        contract: {
          include: {
            proposal: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    const update = await this.prisma.projectUpdate.create({
      data: {
        projectId,
        stage: dto.stage ?? ProjectStage.PREPARATION,
        title: dto.title?.trim() || `${vendor.name} shared a vendor update`,
        body:
          dto.body?.trim() ||
          `${vendor.name} marked progress on their assigned work.`,
        createdById: user.userId,
        isInternal: true,
      },
      include: {
        createdBy: {
          select: this.getUserSummarySelect(),
        },
      },
    });

    await Promise.all(
      project.assignments.map((assignment) =>
        this.notificationsService.createInApp({
          userId: assignment.userId,
          type: NotificationType.STATUS,
          title: update.title,
          body: update.body ?? 'A vendor posted a new update.',
          actionUrl: `/staff/projects/${project.id}`,
          metadata: {
            projectId,
            updateId: update.id,
            vendorId: vendor.id,
          },
        }),
      ),
    );

    return update;
  }

  async listNotifications(userId: string) {
    return this.notificationsService.listForUser(userId, 50);
  }

  async markNotificationRead(userId: string, notificationId: string) {
    await this.notificationsService.markRead(userId, notificationId);
    return { success: true };
  }

  private async getVendorForUser(userId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: {
        userId,
        deletedAt: null,
      },
    });

    if (!vendor) {
      throw new ForbiddenException(
        'Vendor account is not linked to a vendor profile.',
      );
    }

    return vendor;
  }

  private getProjectInclude() {
    return vendorProjectInclude;
  }

  private getUserSummarySelect() {
    return {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
    } satisfies Prisma.UserSelect;
  }
}
