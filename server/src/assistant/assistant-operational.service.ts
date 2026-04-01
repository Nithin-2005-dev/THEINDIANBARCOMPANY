import { Injectable } from '@nestjs/common';
import {
  ContractStatus,
  LeadStatus,
  PaymentStatus,
  Prisma,
  ProjectStatus,
  ProjectTaskStatus,
  ProposalStatus,
  Role,
} from '@prisma/client';
import type { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const operationalUserSelect = {
  id: true,
  name: true,
  role: true,
  isActive: true,
} satisfies Prisma.UserSelect;

const operationalVendorSelect = {
  id: true,
  name: true,
  serviceType: true,
  userId: true,
} satisfies Prisma.VendorSelect;

export type AssistantOperationalRecordKind =
  | 'booking'
  | 'task'
  | 'payment'
  | 'contract'
  | 'project'
  | 'approval'
  | 'thread'
  | 'notification';

export type AssistantOperationalRecord = {
  id: string;
  kind: AssistantOperationalRecordKind;
  title: string;
  subtitle: string;
  reason: string;
  reasons: string[];
  severity: number;
  sortAt: string;
  leadId?: string | null;
  projectId?: string | null;
  paymentId?: string | null;
  contractId?: string | null;
  taskId?: string | null;
  threadId?: string | null;
  city?: string | null;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  unreadCount?: number | null;
  staff?: string[];
};

export type AssistantOperationalBucket = {
  count: number;
  totalSeverity: number;
  items: AssistantOperationalRecord[];
};

export type AssistantOperationalUnreadBucket = {
  notifications: AssistantOperationalBucket;
  threads: AssistantOperationalBucket;
  messages: number;
};

export type AssistantOperationalSummary = {
  generatedAt: string;
  counts: {
    unreadNotifications: number;
    unreadThreads: number;
    unreadMessages: number;
    overduePayments: number;
    overduePaymentAmount: number;
    unsignedContracts: number;
    pendingTasks: number;
    overdueTasks: number;
    blockedTasks: number;
    upcomingBookings: number;
    blockedBookings: number;
    stalledProjects: number;
    missingAssignments: number;
    pendingApprovals: number;
  };
  unread: AssistantOperationalUnreadBucket;
  pendingTasks: AssistantOperationalBucket & {
    overdueCount: number;
    blockedCount: number;
  };
  overdueItems: AssistantOperationalBucket;
  upcomingBookings: AssistantOperationalBucket;
  blockedBookings: AssistantOperationalBucket;
  stalledProjects: AssistantOperationalBucket;
  missingAssignments: AssistantOperationalBucket;
  pendingApprovals: AssistantOperationalBucket;
  overduePayments: AssistantOperationalBucket & {
    totalAmount: number;
  };
  unsignedContracts: AssistantOperationalBucket;
  topIssues: AssistantOperationalRecord[];
  isEmpty: boolean;
  calmState: string[];
};

type OperationalData = {
  activeProjects: any[];
  upcomingLeads: any[];
  unreadThreads: any[];
  unreadNotifications: any[];
};

@Injectable()
export class AssistantOperationalService {
  constructor(private readonly prisma: PrismaService) {}

  async getOperationalSummary(
    user: AuthUser,
  ): Promise<AssistantOperationalSummary> {
    const data = await this.loadOperationalData(user);

    return this.buildOperationalSummary(user, data);
  }

  async getPendingTasksSummary(user: AuthUser) {
    const data = await this.loadOperationalData(user);
    return this.buildPendingTasksBucket(user, data);
  }

  async getUpcomingBookings(user: AuthUser) {
    const data = await this.loadOperationalData(user);
    return this.buildUpcomingBookingsBucket(user, data);
  }

  async getBlockedBookings(user: AuthUser) {
    const data = await this.loadOperationalData(user);
    return this.buildBlockedBookingsBucket(user, data);
  }

  async getUnreadSummary(user: AuthUser) {
    const data = await this.loadOperationalData(user);
    return this.buildUnreadSummary(user, data);
  }

  async getOverduePayments(user: AuthUser) {
    const data = await this.loadOperationalData(user);
    return this.buildOverduePaymentsBucket(user, data);
  }

  async getUnsignedContracts(user: AuthUser) {
    const data = await this.loadOperationalData(user);
    return this.buildUnsignedContractsBucket(user, data);
  }

  async getPendingApprovals(user: AuthUser) {
    const data = await this.loadOperationalData(user);
    return this.buildPendingApprovalsBucket(user, data);
  }

  async getStalledProjects(user: AuthUser) {
    const data = await this.loadOperationalData(user);
    return this.buildStalledProjectsBucket(user, data);
  }

  async getMissingAssignments(user: AuthUser) {
    const data = await this.loadOperationalData(user);
    return this.buildMissingAssignmentsBucket(user, data);
  }

  async getOverdueItems(user: AuthUser) {
    const data = await this.loadOperationalData(user);
    const pendingTasks = this.buildPendingTasksBucket(user, data);
    const overduePayments = this.buildOverduePaymentsBucket(user, data);
    const unsignedContracts = this.buildUnsignedContractsBucket(user, data);

    return this.buildOverdueItemsBucket(
      user,
      data,
      pendingTasks,
      overduePayments,
      unsignedContracts,
    );
  }

  private async loadOperationalData(user: AuthUser): Promise<OperationalData> {
    const now = new Date();
    const upcomingCutoff = new Date(now.getTime() + 14 * DAY_MS);

    const [activeProjects, upcomingLeads, unreadThreads, unreadNotifications] =
      await Promise.all([
        this.prisma.project.findMany({
          where: {
            deletedAt: null,
            status: {
              notIn: [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED],
            },
            ...this.buildProjectAccessWhere(user),
          },
          orderBy: [{ updatedAt: 'desc' }],
          include: {
            contract: {
              include: {
                proposal: {
                  include: {
                    lead: {
                      include: {
                        assignments: {
                          where: { isActive: true },
                          include: {
                            user: {
                              select: operationalUserSelect,
                            },
                          },
                          orderBy: { startedAt: 'asc' },
                        },
                      },
                    },
                  },
                },
              },
            },
            assignments: {
              where: { isActive: true },
              include: {
                user: {
                  select: operationalUserSelect,
                },
              },
              orderBy: { startedAt: 'asc' },
            },
            tasks: {
              where: { deletedAt: null },
              orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
              include: {
                assignedUser: {
                  select: operationalUserSelect,
                },
                assignedVendor: {
                  select: operationalVendorSelect,
                },
              },
            },
            payments: {
              where: {
                deletedAt: null,
                status: {
                  in: [PaymentStatus.PENDING, PaymentStatus.FAILED],
                },
              },
              orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
            },
          },
        }),
        this.prisma.lead.findMany({
          where: {
            deletedAt: null,
            status: {
              not: LeadStatus.LOST,
            },
            eventDate: {
              gte: now,
              lte: upcomingCutoff,
            },
            ...this.buildLeadAccessWhere(user),
          },
          orderBy: [{ eventDate: 'asc' }],
          include: {
            assignments: {
              where: { isActive: true },
              include: {
                user: {
                  select: operationalUserSelect,
                },
              },
              orderBy: { startedAt: 'asc' },
            },
            proposals: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                contract: {
                  select: {
                    id: true,
                    status: true,
                    signedAt: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.conversationThread.findMany({
          where: {
            lead: {
              is: this.buildLeadAccessWhere(user),
            },
            messages: {
              some: {
                senderId: {
                  not: user.userId,
                },
                readAt: null,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          include: {
            lead: {
              select: {
                id: true,
                eventType: true,
                location: true,
                city: true,
                eventDate: true,
                status: true,
              },
            },
            messages: {
              where: {
                senderId: {
                  not: user.userId,
                },
                readAt: null,
              },
              orderBy: { createdAt: 'desc' },
              take: 5,
              select: {
                id: true,
                body: true,
                createdAt: true,
              },
            },
          },
        }),
        this.prisma.notification.findMany({
          where: {
            userId: user.userId,
            readAt: null,
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            title: true,
            body: true,
            actionUrl: true,
            type: true,
            createdAt: true,
          },
        }),
      ]);

    return {
      activeProjects,
      upcomingLeads,
      unreadThreads,
      unreadNotifications,
    };
  }

  private buildOperationalSummary(
    user: AuthUser,
    data: OperationalData,
  ): AssistantOperationalSummary {
    const unread = this.buildUnreadSummary(user, data);
    const pendingTasks = this.buildPendingTasksBucket(user, data);
    const overduePayments = this.buildOverduePaymentsBucket(user, data);
    const unsignedContracts = this.buildUnsignedContractsBucket(user, data);
    const pendingApprovals = this.buildPendingApprovalsBucket(user, data);
    const upcomingBookings = this.buildUpcomingBookingsBucket(user, data);
    const blockedBookings = this.buildBlockedBookingsBucket(user, data);
    const stalledProjects = this.buildStalledProjectsBucket(user, data);
    const missingAssignments = this.buildMissingAssignmentsBucket(user, data);
    const overdueItems = this.buildOverdueItemsBucket(
      user,
      data,
      pendingTasks,
      overduePayments,
      unsignedContracts,
    );

    const topIssues = this.rankOperationalRecords([
      ...overdueItems.items,
      ...blockedBookings.items,
      ...pendingTasks.items,
      ...pendingApprovals.items,
      ...stalledProjects.items,
      ...missingAssignments.items,
      ...unread.threads.items,
      ...unread.notifications.items,
    ]).slice(0, 8);

    const counts = {
      unreadNotifications: unread.notifications.count,
      unreadThreads: unread.threads.count,
      unreadMessages: unread.messages,
      overduePayments: overduePayments.count,
      overduePaymentAmount: overduePayments.totalAmount,
      unsignedContracts: unsignedContracts.count,
      pendingTasks: pendingTasks.count,
      overdueTasks: pendingTasks.overdueCount,
      blockedTasks: pendingTasks.blockedCount,
      upcomingBookings: upcomingBookings.count,
      blockedBookings: blockedBookings.count,
      stalledProjects: stalledProjects.count,
      missingAssignments: missingAssignments.count,
      pendingApprovals: pendingApprovals.count,
    };

    const isEmpty =
      counts.overduePayments === 0 &&
      counts.unsignedContracts === 0 &&
      counts.pendingTasks === 0 &&
      counts.overdueTasks === 0 &&
      counts.blockedBookings === 0 &&
      counts.stalledProjects === 0 &&
      counts.missingAssignments === 0 &&
      counts.pendingApprovals === 0 &&
      counts.unreadThreads === 0;

    const calmState = isEmpty
      ? [
          'Everything looks clean right now. No overdue payments, blocked bookings, or unsigned contracts.',
          upcomingBookings.count
            ? `${upcomingBookings.count} upcoming booking${upcomingBookings.count === 1 ? '' : 's'} are still on the calendar.`
            : 'No upcoming bookings are inside the 14-day window right now.',
          unread.notifications.count
            ? `${unread.notifications.count} unread notification${unread.notifications.count === 1 ? '' : 's'} are waiting in the inbox.`
            : 'No unread notifications are showing right now.',
        ]
      : [];

    return {
      generatedAt: new Date().toISOString(),
      counts,
      unread,
      pendingTasks,
      overdueItems,
      upcomingBookings,
      blockedBookings,
      stalledProjects,
      missingAssignments,
      pendingApprovals,
      overduePayments,
      unsignedContracts,
      topIssues,
      isEmpty,
      calmState,
    };
  }

  private buildUnreadSummary(user: AuthUser, data: OperationalData) {
    const notificationItems = data.unreadNotifications
      .map((notification) =>
        this.toNotificationRecord(notification, user.userId),
      )
      .sort((left, right) => right.severity - left.severity)
      .slice(0, 5);

    const threadItems = data.unreadThreads
      .map((thread) => this.toThreadRecord(thread, user.userId))
      .sort((left, right) => right.severity - left.severity)
      .slice(0, 5);

    const unreadMessages = data.unreadThreads.reduce(
      (sum, thread) => sum + thread.messages.length,
      0,
    );

    return {
      notifications: {
        count: data.unreadNotifications.length,
        totalSeverity: this.sumSeverity(notificationItems),
        items: notificationItems,
      },
      threads: {
        count: data.unreadThreads.length,
        totalSeverity: this.sumSeverity(threadItems),
        items: threadItems,
      },
      messages: unreadMessages,
    };
  }

  private buildPendingTasksBucket(user: AuthUser, data: OperationalData) {
    const now = new Date();
    const items = this.buildTaskRecords(user, data, now);
    const ordered = this.rankOperationalRecords(items).slice(0, 6);

    return {
      count: items.length,
      totalSeverity: this.sumSeverity(items),
      items: ordered,
      overdueCount: items.filter((item) =>
        item.reasons.some((reason) => reason.startsWith('Overdue')),
      ).length,
      blockedCount: items.filter((item) =>
        item.reasons.some((reason) => reason.includes('blocked')),
      ).length,
    };
  }

  private buildOverduePaymentsBucket(user: AuthUser, data: OperationalData) {
    const now = new Date();
    const items = this.buildPaymentRecords(user, data, now);
    const ordered = this.rankOperationalRecords(items).slice(0, 6);
    const totalAmount = items.reduce(
      (sum, item) => sum + (item.amount ?? 0),
      0,
    );

    return {
      count: items.length,
      totalSeverity: this.sumSeverity(items),
      items: ordered,
      totalAmount,
    };
  }

  private buildUnsignedContractsBucket(user: AuthUser, data: OperationalData) {
    const now = new Date();
    const items = this.buildContractRecords(user, data, now).filter(
      (item) => item.status !== 'SIGNED',
    );
    const ordered = this.rankOperationalRecords(items).slice(0, 6);

    return {
      count: items.length,
      totalSeverity: this.sumSeverity(items),
      items: ordered,
    };
  }

  private buildPendingApprovalsBucket(user: AuthUser, data: OperationalData) {
    const now = new Date();
    const items = this.buildApprovalRecords(user, data, now);
    const ordered = this.rankOperationalRecords(items).slice(0, 6);

    return {
      count: items.length,
      totalSeverity: this.sumSeverity(items),
      items: ordered,
    };
  }

  private buildUpcomingBookingsBucket(user: AuthUser, data: OperationalData) {
    const now = new Date();
    const items = this.buildBookingRiskRecords(user, data, now).filter(
      (item) => this.isWithinUpcomingWindow(item, now),
    );
    const ordered = this.rankOperationalRecords(items).slice(0, 6);

    return {
      count: items.length,
      totalSeverity: this.sumSeverity(items),
      items: ordered,
    };
  }

  private buildBlockedBookingsBucket(user: AuthUser, data: OperationalData) {
    const now = new Date();
    const items = this.buildBookingRiskRecords(user, data, now).filter(
      (item) =>
        item.severity >= 2 &&
        item.reasons.some((reason) =>
          /assignment|contract|payment|blocked|stalled|project/i.test(reason),
        ),
    );
    const ordered = this.rankOperationalRecords(items).slice(0, 6);

    return {
      count: items.length,
      totalSeverity: this.sumSeverity(items),
      items: ordered,
    };
  }

  private buildStalledProjectsBucket(user: AuthUser, data: OperationalData) {
    const now = new Date();
    const items = this.buildProjectRecords(user, data, now).filter((item) =>
      item.reasons.some((reason) => reason.includes('stalled')),
    );
    const ordered = this.rankOperationalRecords(items).slice(0, 6);

    return {
      count: items.length,
      totalSeverity: this.sumSeverity(items),
      items: ordered,
    };
  }

  private buildMissingAssignmentsBucket(user: AuthUser, data: OperationalData) {
    const now = new Date();
    const items = this.buildBookingRiskRecords(user, data, now).filter(
      (item) => !item.staff?.length,
    );
    const ordered = this.rankOperationalRecords(items).slice(0, 6);

    return {
      count: items.length,
      totalSeverity: this.sumSeverity(items),
      items: ordered,
    };
  }

  private buildOverdueItemsBucket(
    user: AuthUser,
    data: OperationalData,
    pendingTasks: AssistantOperationalBucket & {
      overdueCount: number;
      blockedCount: number;
    },
    overduePayments: AssistantOperationalBucket & {
      totalAmount: number;
    },
    unsignedContracts: AssistantOperationalBucket,
  ) {
    void user;
    const taskOverdues = pendingTasks.items.filter((item) =>
      item.reasons.some((reason) => reason.startsWith('Overdue')),
    );
    const contractOverdues = unsignedContracts.items.filter((item) =>
      item.reasons.some(
        (reason) =>
          reason.includes('Open for') || reason.includes('Event is close'),
      ),
    );
    const items = this.rankOperationalRecords([
      ...overduePayments.items,
      ...taskOverdues,
      ...contractOverdues,
    ]).slice(0, 6);

    return {
      count: overduePayments.count + taskOverdues.length + contractOverdues.length,
      totalSeverity: this.sumSeverity(items),
      items,
    };
  }

  private buildTaskRecords(
    user: AuthUser,
    data: OperationalData,
    now: Date,
  ): AssistantOperationalRecord[] {
    void user;
    const records: AssistantOperationalRecord[] = [];

    for (const project of data.activeProjects) {
      const lead = project.contract?.proposal?.lead ?? null;
      const bookingLabel = this.buildBookingLabel(lead, project);

      for (const task of project.tasks ?? []) {
        if (task.status === ProjectTaskStatus.DONE) {
          continue;
        }

        const reasons: string[] = [];
        let severity = 0;
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        const daysUntilDue = dueDate ? this.daysUntil(dueDate, now) : null;

        if (task.status === ProjectTaskStatus.BLOCKED) {
          severity += 2;
          reasons.push('Task is blocked');
        }

        if (dueDate && dueDate.getTime() < now.getTime()) {
          severity += 3;
          reasons.push(
            `Overdue by ${this.describeDays(now.getTime() - dueDate.getTime())}`,
          );
        } else if (daysUntilDue !== null && daysUntilDue <= 3) {
          severity += 1;
          reasons.push(`Due ${this.describeDays(dueDate!.getTime() - now.getTime())}`);
        }

        const staff = this.uniqueStrings([
          task.assignedUser?.name ?? null,
          task.assignedVendor?.name ?? null,
        ]);

        if (!staff.length) {
          severity += 2;
          reasons.push('Task is unassigned');
        }

        if (task.priority === 'CRITICAL') {
          severity += 1;
          reasons.push('Critical priority');
        }

        if (task.blockedReason) {
          severity += 1;
          reasons.push(task.blockedReason);
        }

        records.push({
          id: task.id,
          kind: 'task',
          title: task.title,
          subtitle: `${bookingLabel} · ${task.status}${
            dueDate ? ` · ${this.formatDate(dueDate)}` : ''
          }`,
          reason: reasons[0] ?? 'Open task needs movement',
          reasons,
          severity,
          sortAt: dueDate?.toISOString() ?? new Date(project.updatedAt ?? now).toISOString(),
          leadId: lead?.id ?? null,
          projectId: project.id,
          taskId: task.id,
          city: lead?.city ?? null,
          status: task.status,
          staff,
        });
      }
    }

    return records;
  }

  private buildPaymentRecords(
    user: AuthUser,
    data: OperationalData,
    now: Date,
  ): AssistantOperationalRecord[] {
    void user;
    const records: AssistantOperationalRecord[] = [];

    for (const project of data.activeProjects) {
      const lead = project.contract?.proposal?.lead ?? null;
      const bookingLabel = this.buildBookingLabel(lead, project);

      for (const payment of project.payments ?? []) {
        const dueDate = payment.dueDate ? new Date(payment.dueDate) : null;
        if (!dueDate || dueDate.getTime() >= now.getTime()) {
          continue;
        }

        const reasons = [
          payment.status === PaymentStatus.FAILED
            ? 'Payment failed'
            : 'Payment is overdue',
          `Due ${this.formatDate(dueDate)}`,
        ];

        const severity = payment.status === PaymentStatus.FAILED ? 4 : 3;

        records.push({
          id: payment.id,
          kind: 'payment',
          title: `${payment.type} payment`,
          subtitle: `${bookingLabel} · ${this.formatCurrency(
            payment.amount,
            payment.currency,
          )} · ${this.describeDays(now.getTime() - dueDate.getTime())}`,
          reason: reasons[0],
          reasons,
          severity,
          sortAt: dueDate.toISOString(),
          leadId: lead?.id ?? null,
          projectId: project.id,
          paymentId: payment.id,
          city: lead?.city ?? null,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
        });
      }
    }

    return records;
  }

  private buildContractRecords(
    user: AuthUser,
    data: OperationalData,
    now: Date,
  ): AssistantOperationalRecord[] {
    void user;
    const records: AssistantOperationalRecord[] = [];

    for (const project of data.activeProjects) {
      const lead = project.contract?.proposal?.lead ?? null;
      const contract = project.contract ?? null;

      if (!contract) {
        continue;
      }

      if (
        contract.status !== ContractStatus.DRAFT &&
        contract.status !== ContractStatus.SENT
      ) {
        continue;
      }

      const daysOpen = contract.createdAt
        ? this.daysUntil(now, new Date(contract.createdAt))
        : null;
      const daysUntilEvent = lead?.eventDate
        ? this.daysUntil(new Date(lead.eventDate), now)
        : null;
      const reasons = [
        contract.status === ContractStatus.DRAFT
          ? 'Contract is still a draft'
          : 'Waiting on signature',
      ];

      if (
        daysOpen !== null &&
        daysOpen >= 3 &&
        contract.status === ContractStatus.SENT
      ) {
        reasons.push(`Open for more than ${daysOpen} days`);
      }

      if (daysUntilEvent !== null && daysUntilEvent <= 3) {
        reasons.push('Event is close and the contract is still unsigned');
      }

      const severity =
        contract.status === ContractStatus.SENT
          ? 2 + (daysUntilEvent !== null && daysUntilEvent <= 3 ? 1 : 0)
          : 1;

      records.push({
        id: contract.id,
        kind: 'contract',
        title: `${this.buildBookingLabel(lead, project)} contract`,
        subtitle: `${contract.status}${lead?.city ? ` · ${lead.city}` : ''}`,
        reason: reasons[0],
        reasons,
        severity,
        sortAt: new Date(contract.updatedAt ?? now).toISOString(),
        leadId: lead?.id ?? null,
        projectId: project.id,
        contractId: contract.id,
        city: lead?.city ?? null,
        status: contract.status,
      });
    }

    return records;
  }

  private buildApprovalRecords(
    user: AuthUser,
    data: OperationalData,
    now: Date,
  ): AssistantOperationalRecord[] {
    void user;
    const records: AssistantOperationalRecord[] = [];

    for (const lead of data.upcomingLeads) {
      const proposal = lead.proposals?.[0] ?? null;
      if (!proposal || proposal.status !== ProposalStatus.SENT) {
        continue;
      }

      const eventDate = new Date(lead.eventDate);
      const daysUntilEvent = this.daysUntil(eventDate, now);
      const reasons = ['Proposal is waiting on approval'];

      if (daysUntilEvent <= 3) {
        reasons.push('Event is close and the proposal is still pending');
      }

      records.push({
        id: proposal.id,
        kind: 'approval',
        title: `${lead.location ?? lead.eventType} proposal`,
        subtitle: `${lead.eventType}${lead.city ? ` · ${lead.city}` : ''} · ${this.formatDate(eventDate)}`,
        reason: reasons[0],
        reasons,
        severity: 2 + (daysUntilEvent <= 3 ? 1 : 0),
        sortAt: eventDate.toISOString(),
        leadId: lead.id,
        city: lead.city ?? null,
        status: proposal.status,
      });
    }

    return records;
  }

  private buildProjectRecords(
    user: AuthUser,
    data: OperationalData,
    now: Date,
  ): AssistantOperationalRecord[] {
    void user;
    const records: AssistantOperationalRecord[] = [];

    for (const project of data.activeProjects) {
      const lead = project.contract?.proposal?.lead ?? null;
      const bookingLabel = this.buildBookingLabel(lead, project);
      const reasons: string[] = [];
      let severity = 0;

      const updatedAt = project.updatedAt ? new Date(project.updatedAt) : null;
      if (updatedAt && now.getTime() - updatedAt.getTime() > 7 * DAY_MS) {
        severity += 2;
        reasons.push('Project has been stalled for more than a week');
      }

      const hasAssignmentCoverage =
        (project.assignments?.length ?? 0) > 0 ||
        (lead?.assignments?.length ?? 0) > 0;

      if (!hasAssignmentCoverage) {
        severity += 2;
        reasons.push('No active staff assignment');
      }

      const overdueTasks = (project.tasks ?? []).filter((task: any) => {
        if (task.status === ProjectTaskStatus.DONE || !task.dueDate) {
          return false;
        }

        return new Date(task.dueDate).getTime() < now.getTime();
      });

      if (overdueTasks.length) {
        severity += 2;
        reasons.push(`${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'}`);
      }

      const blockedTasks = (project.tasks ?? []).filter(
        (task: any) => task.status === ProjectTaskStatus.BLOCKED,
      );

      if (blockedTasks.length) {
        severity += 2;
        reasons.push(`${blockedTasks.length} blocked task${blockedTasks.length === 1 ? '' : 's'}`);
      }

      const unsignedContract =
        project.contract &&
        (project.contract.status === ContractStatus.DRAFT ||
          project.contract.status === ContractStatus.SENT) &&
        !project.contract.signedAt;

      if (unsignedContract) {
        severity += 1;
        reasons.push('Contract is still unsigned');
      }

      records.push({
        id: project.id,
        kind: 'project',
        title: bookingLabel,
        subtitle: `${project.status} · ${project.progress}% progress${
          lead?.city ? ` · ${lead.city}` : ''
        }`,
        reason: reasons[0] ?? 'Active project needs attention',
        reasons,
        severity,
        sortAt: updatedAt?.toISOString() ?? now.toISOString(),
        leadId: lead?.id ?? null,
        projectId: project.id,
        city: lead?.city ?? null,
        status: project.status,
      });
    }

    return records;
  }

  private buildBookingRiskRecords(
    user: AuthUser,
    data: OperationalData,
    now: Date,
  ): AssistantOperationalRecord[] {
    void user;
    const projectByLeadId = new Map<string, any>();

    for (const project of data.activeProjects) {
      const lead = project.contract?.proposal?.lead ?? null;
      if (lead?.id) {
        projectByLeadId.set(lead.id, project);
      }
    }

    const unreadByLeadId = new Map<string, number>();
    for (const thread of data.unreadThreads) {
      const leadId = thread.lead?.id;
      if (!leadId) {
        continue;
      }

      unreadByLeadId.set(
        leadId,
        (unreadByLeadId.get(leadId) ?? 0) + thread.messages.length,
      );
    }

    const itemsByKey = new Map<string, AssistantOperationalRecord>();

    for (const project of data.activeProjects) {
      const lead = project.contract?.proposal?.lead ?? null;
      if (!lead) {
        continue;
      }

      const record = this.toBookingRiskRecord({
        lead,
        project,
        unreadCount: unreadByLeadId.get(lead.id) ?? 0,
        now,
      });

      itemsByKey.set(record.projectId ?? record.leadId ?? record.id, record);
    }

    for (const lead of data.upcomingLeads) {
      if (projectByLeadId.has(lead.id)) {
        continue;
      }

      const record = this.toBookingRiskRecord({
        lead,
        project: null,
        unreadCount: unreadByLeadId.get(lead.id) ?? 0,
        now,
      });

      itemsByKey.set(record.leadId ?? record.id, record);
    }

    return this.rankOperationalRecords(Array.from(itemsByKey.values()));
  }

  private toBookingRiskRecord(input: {
    lead: any;
    project: any | null;
    unreadCount: number;
    now: Date;
  }): AssistantOperationalRecord {
    const { lead, project, unreadCount, now } = input;
    const bookingLabel = this.buildBookingLabel(lead, project);
    const reasons: string[] = [];
    let severity = 0;

    const eventDate = lead.eventDate ? new Date(lead.eventDate) : null;
    const daysUntilEvent = eventDate ? this.daysUntil(eventDate, now) : null;

    if (daysUntilEvent !== null && daysUntilEvent >= 0) {
      if (daysUntilEvent <= 3) {
        severity += 3;
        reasons.push(`Event is in ${this.describeDays(daysUntilEvent * DAY_MS)}`);
      } else if (daysUntilEvent <= 7) {
        severity += 2;
        reasons.push(`Event is in ${this.describeDays(daysUntilEvent * DAY_MS)}`);
      } else if (daysUntilEvent <= 14) {
        severity += 1;
        reasons.push(`Event is in ${this.describeDays(daysUntilEvent * DAY_MS)}`);
      }
    }

    const leadAssignments = lead.assignments ?? [];
    const projectAssignments = project?.assignments ?? [];
    const staff = this.uniqueStrings([
      ...leadAssignments.map((assignment: any) => assignment.user?.name ?? null),
      ...projectAssignments.map((assignment: any) => assignment.user?.name ?? null),
    ]);

    if (!staff.length) {
      severity += 2;
      reasons.push('No active staff assignment');
    }

    if (unreadCount > 0) {
      severity += 1;
      reasons.push(`${unreadCount} unread client message${unreadCount === 1 ? '' : 's'}`);
    }

    const tasks = project?.tasks ?? [];
    const overdueTasks = tasks.filter((task: any) => {
      if (!task.dueDate || task.status === ProjectTaskStatus.DONE) {
        return false;
      }

      return new Date(task.dueDate).getTime() < now.getTime();
    });

    if (overdueTasks.length) {
      severity += 2;
      reasons.push(`${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'}`);
    }

    const blockedTasks = tasks.filter(
      (task: any) => task.status === ProjectTaskStatus.BLOCKED,
    );

    if (blockedTasks.length) {
      severity += 2;
      reasons.push(`${blockedTasks.length} blocked task${blockedTasks.length === 1 ? '' : 's'}`);
    }

    const overduePayments = (project?.payments ?? []).filter((payment: any) => {
      const dueDate = payment.dueDate ? new Date(payment.dueDate) : null;
      return (
        dueDate !== null &&
        dueDate.getTime() < now.getTime() &&
        [PaymentStatus.PENDING, PaymentStatus.FAILED].includes(payment.status)
      );
    });

    if (overduePayments.length) {
      severity += 3;
      const totalAmount = overduePayments.reduce(
        (sum: number, payment: any) => sum + payment.amount,
        0,
      );
      reasons.push(
        `${overduePayments.length} overdue payment${overduePayments.length === 1 ? '' : 's'} totaling ${this.formatCurrency(totalAmount, overduePayments[0]?.currency ?? 'INR')}`,
      );
    }

    const contract = project?.contract ?? lead.proposals?.[0]?.contract ?? null;
    const proposal = project?.contract?.proposal ?? lead.proposals?.[0] ?? null;

    if (
      contract &&
      (contract.status === ContractStatus.DRAFT ||
        contract.status === ContractStatus.SENT) &&
      !contract.signedAt
    ) {
      severity += 2;
      reasons.push('Unsigned contract');
    }

    if (proposal?.status === ProposalStatus.SENT) {
      severity += 1;
      reasons.push('Proposal is waiting on approval');
    }

    const projectUpdatedAt = project?.updatedAt
      ? new Date(project.updatedAt)
      : null;
    if (
      projectUpdatedAt &&
      now.getTime() - projectUpdatedAt.getTime() > 7 * DAY_MS
    ) {
      severity += 2;
      reasons.push('Project has been stalled for more than a week');
    }

    if (!project) {
      severity += 1;
      reasons.push('No project has been created yet');
    }

    const reason = reasons[0] ?? 'Booking needs attention';

    return {
      id: project?.id ?? lead.id,
      kind: 'booking',
      title: lead.location ?? lead.eventType ?? 'Upcoming booking',
      subtitle: `${lead.eventType}${lead.city ? ` · ${lead.city}` : ''}${
        eventDate ? ` · ${this.formatDate(eventDate)}` : ''
      }`,
      reason,
      reasons,
      severity,
      sortAt: eventDate?.toISOString() ?? now.toISOString(),
      leadId: lead.id,
      projectId: project?.id ?? null,
      city: lead.city ?? null,
      status: lead.status,
      unreadCount,
      staff,
    };
  }

  private toNotificationRecord(
    notification: any,
    userId: string,
  ): AssistantOperationalRecord {
    void userId;
    const reason = notification.body
      ? notification.body.slice(0, 120)
      : 'Unread notification';

    return {
      id: notification.id,
      kind: 'notification',
      title: notification.title,
      subtitle: `${this.formatDate(notification.createdAt)} · ${notification.type}`,
      reason,
      reasons: [reason],
      severity: 1,
      sortAt: new Date(notification.createdAt).toISOString(),
      status: notification.type,
    };
  }

  private toThreadRecord(thread: any, userId: string): AssistantOperationalRecord {
    void userId;
    const lead = thread.lead ?? null;
    const unreadCount = thread.messages.length;
    const latestMessage = thread.messages[0]?.body ?? '';
    const title = lead?.location ?? lead?.eventType ?? 'Unread chat';
    const subtitle = `${unreadCount} unread message${unreadCount === 1 ? '' : 's'}${
      lead?.city ? ` · ${lead.city}` : ''
    }`;

    return {
      id: thread.id,
      kind: 'thread',
      title,
      subtitle,
      reason: latestMessage ? latestMessage.slice(0, 120) : 'Waiting for a reply',
      reasons: latestMessage ? [latestMessage.slice(0, 120)] : ['Waiting for a reply'],
      severity: 1 + Math.min(unreadCount, 3),
      sortAt: new Date(thread.updatedAt ?? new Date()).toISOString(),
      leadId: lead?.id ?? null,
      city: lead?.city ?? null,
      status: lead?.status ?? null,
      unreadCount,
    };
  }

  private buildBookingLabel(lead: any | null, project: any | null) {
    const title = lead?.location ?? project?.summary ?? lead?.eventType ?? 'Booking';
    const city = lead?.city ? `, ${lead.city}` : '';
    return `${title}${city}`.trim();
  }

  private rankOperationalRecords(records: AssistantOperationalRecord[]) {
    return [...records].sort((left, right) => {
      if (right.severity !== left.severity) {
        return right.severity - left.severity;
      }

      const leftTime = new Date(left.sortAt).getTime();
      const rightTime = new Date(right.sortAt).getTime();
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return left.title.localeCompare(right.title);
    });
  }

  private sumSeverity(records: AssistantOperationalRecord[]) {
    return records.reduce((sum, record) => sum + record.severity, 0);
  }

  private uniqueStrings(values: Array<string | null | undefined>) {
    return Array.from(
      new Set(
        values
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );
  }

  private isWithinUpcomingWindow(record: AssistantOperationalRecord, now: Date) {
    const time = new Date(record.sortAt).getTime();
    return time >= now.getTime() && time <= now.getTime() + 14 * DAY_MS;
  }

  private daysUntil(target: Date, now: Date) {
    return Math.ceil((target.getTime() - now.getTime()) / DAY_MS);
  }

  private describeDays(value: number) {
    const days = Math.ceil(Math.abs(value) / DAY_MS);
    if (days <= 0) {
      return 'today';
    }

    if (days === 1) {
      return value >= 0 ? 'tomorrow' : '1 day overdue';
    }

    return value >= 0 ? `in ${days} days` : `${days} days overdue`;
  }

  private formatDate(value: string | Date) {
    const date = new Date(value);
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private formatCurrency(amount: number, currency = 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private buildLeadAccessWhere(user: AuthUser): Prisma.LeadWhereInput {
    switch (user.role) {
      case Role.CLIENT:
        return {
          deletedAt: null,
          clientId: user.userId,
        };
      case Role.ADMIN:
        return {
          deletedAt: null,
        };
      case Role.VENDOR:
        return {
          deletedAt: null,
          proposals: {
            some: {
              contract: {
                is: {
                  project: {
                    is: {
                      vendors: {
                        some: {
                          vendor: {
                            is: {
                              userId: user.userId,
                              deletedAt: null,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        };
      default:
        return {
          deletedAt: null,
          assignments: {
            some: {
              userId: user.userId,
              isActive: true,
            },
          },
        };
    }
  }

  private buildProjectAccessWhere(user: AuthUser): Prisma.ProjectWhereInput {
    switch (user.role) {
      case Role.CLIENT:
        return {
          deletedAt: null,
          clientId: user.userId,
        };
      case Role.ADMIN:
        return {
          deletedAt: null,
        };
      case Role.VENDOR:
        return {
          deletedAt: null,
          vendors: {
            some: {
              vendor: {
                is: {
                  userId: user.userId,
                  deletedAt: null,
                },
              },
            },
          },
        };
      default:
        return {
          deletedAt: null,
          assignments: {
            some: {
              userId: user.userId,
              isActive: true,
            },
          },
        };
    }
  }
}
