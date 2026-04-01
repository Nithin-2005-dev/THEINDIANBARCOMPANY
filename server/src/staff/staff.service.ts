import { ForbiddenException, Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma, ProjectTaskStatus, Role } from '@prisma/client';
import { ClientPortalService } from '../client-portal/client-portal.service';
import { isAdminRole, isStaffRole } from '../common/auth/role-helpers';
import type { AuthUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly clientPortalService: ClientPortalService,
  ) {}

  async getDashboard(user: AuthUser) {
    this.ensureStaff(user);

    const [notifications, inbox] = await Promise.all([
      this.notificationsService.listForUser(user.userId, 20),
      this.listInbox(user),
    ]);

    const [leads, projects, tasks, payments] = await Promise.all([
      this.prisma.lead.findMany({
        where: this.buildLeadWhere(user),
        include: {
          client: {
            select: this.getUserSummarySelect(),
          },
          assignments: {
            where: { isActive: true },
            include: {
              user: {
                select: this.getUserSummarySelect(),
              },
            },
          },
        },
        orderBy: [{ eventDate: 'asc' }, { createdAt: 'desc' }],
        take: 12,
      }),
      this.prisma.project.findMany({
        where: this.buildProjectWhere(user),
        include: {
          client: {
            select: this.getUserSummarySelect(),
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
          assignments: {
            where: { isActive: true },
            include: {
              user: {
                select: this.getUserSummarySelect(),
              },
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 12,
      }),
      this.prisma.projectTask.findMany({
        where: this.buildTaskWhere(user),
        include: {
          project: {
            include: {
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
          },
          assignedUser: {
            select: this.getUserSummarySelect(),
          },
          assignedVendor: true,
        },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 20,
      }),
      this.prisma.payment.findMany({
        where: this.buildPaymentWhere(user),
        include: {
          project: {
            include: {
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
          },
        },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        take: 20,
      }),
    ]);

    return {
      profile: {
        id: user.userId,
        role: user.role,
      },
      summary: {
        assignedLeads: leads.length,
        activeProjects: projects.filter(
          (project) => !['COMPLETED', 'CANCELLED'].includes(project.status),
        ).length,
        openTasks: tasks.filter(
          (task) => task.status !== ProjectTaskStatus.DONE,
        ).length,
        overdueTasks: tasks.filter(
          (task) =>
            task.status !== ProjectTaskStatus.DONE &&
            task.dueDate &&
            task.dueDate.getTime() < Date.now(),
        ).length,
        outstandingPayments: payments
          .filter((payment) => payment.status === PaymentStatus.PENDING)
          .reduce((sum, payment) => sum + payment.amount, 0),
      },
      leads,
      projects,
      tasks,
      payments,
      inbox,
      notifications,
    };
  }

  async listInbox(user: AuthUser) {
    this.ensureStaff(user);
    return this.clientPortalService.listInbox(user);
  }

  async listNotifications(userId: string) {
    return this.notificationsService.listForUser(userId, 50);
  }

  async markNotificationRead(userId: string, notificationId: string) {
    await this.notificationsService.markRead(userId, notificationId);
    return { success: true };
  }

  private ensureStaff(user: AuthUser) {
    if (!isStaffRole(user.role)) {
      throw new ForbiddenException('Staff access required.');
    }
  }

  private buildLeadWhere(user: AuthUser): Prisma.LeadWhereInput {
    return {
      deletedAt: null,
      ...(isAdminRole(user.role)
        ? {}
        : {
            assignments: {
              some: {
                userId: user.userId,
                isActive: true,
              },
            },
          }),
    };
  }

  private buildProjectWhere(user: AuthUser): Prisma.ProjectWhereInput {
    return {
      deletedAt: null,
      ...(isAdminRole(user.role)
        ? {}
        : {
            assignments: {
              some: {
                userId: user.userId,
                isActive: true,
              },
            },
          }),
    };
  }

  private buildTaskWhere(user: AuthUser): Prisma.ProjectTaskWhereInput {
    if (isAdminRole(user.role)) {
      return {
        deletedAt: null,
      };
    }

    return {
      deletedAt: null,
      OR: [
        { assignedUserId: user.userId },
        {
          project: {
            assignments: {
              some: {
                userId: user.userId,
                isActive: true,
              },
            },
          },
        },
      ],
    };
  }

  private buildPaymentWhere(user: AuthUser): Prisma.PaymentWhereInput {
    if (user.role === Role.FINANCE || isAdminRole(user.role)) {
      return { deletedAt: null };
    }

    return {
      deletedAt: null,
      project: {
        assignments: {
          some: {
            userId: user.userId,
            isActive: true,
          },
        },
      },
    };
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
