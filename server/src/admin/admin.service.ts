import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatus, Prisma, ProjectTaskStatus, Role } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import type {
  AssistantAnalyticsQueryDto,
  AssistantAnalyticsRange,
  AssistantAnalyticsRoleFilter,
} from './dto/assistant-analytics-query.dto';

type AssistantAnalyticsEventRecord = {
  id: string;
  userId: string;
  role: Role;
  eventType: string;
  intent: string | null;
  label: string | null;
  contentSnippet: string | null;
  conversationId: string | null;
  messageId: string | null;
  pageKey: string | null;
  section: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

type AssistantAnalyticsConversationRecord = {
  id: string;
  isArchived: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
  messageCount: number;
  role: Role;
  _count: {
    messages: number;
  };
};

type AssistantAnalyticsSummary = {
  windowDays: number;
  filters: {
    range: AssistantAnalyticsRange;
    role: AssistantAnalyticsRoleFilter;
    pageKey: string | null;
    search: string | null;
  };
  totalEvents: number;
  totalConversations: number;
  activeUsers: number;
  averageThreadLength: number;
  fallbackRate: number;
  averageResponseTimeMs: number;
  averageResponseTimeLabel: string;
  pinnedConversations: number;
  archivedConversations: number;
  mostCommonPrompts: Array<{
    label: string;
    count: number;
    intent?: string | null;
    samplePrompt?: string | null;
  }>;
  failedIntents: Array<{
    intent: string;
    count: number;
  }>;
  unansweredQuestions: Array<{
    intent: string;
    count: number;
    sampleQuestion?: string | null;
  }>;
  actionUsage: Array<{
    action: string;
    count: number;
  }>;
  bookingQuestions: Array<{
    intent: string;
    count: number;
    sampleQuestion?: string | null;
  }>;
  topIntents: Array<{
    label: string;
    count: number;
    samplePrompt?: string | null;
  }>;
  topUnansweredPrompts: Array<{
    label: string;
    count: number;
    intent?: string | null;
    samplePrompt?: string | null;
    pageKey?: string | null;
  }>;
  topBookingPrompts: Array<{
    label: string;
    count: number;
    intent?: string | null;
    samplePrompt?: string | null;
    pageKey?: string | null;
  }>;
  mostUsedActionButtons: Array<{
    label: string;
    count: number;
    samplePrompt?: string | null;
  }>;
  busiestHours: Array<{
    hour: number;
    label: string;
    count: number;
  }>;
  topRoles: Array<{
    role: Role;
    count: number;
  }>;
  topPages: Array<{
    pageKey: string;
    label: string;
    count: number;
    samplePrompt?: string | null;
  }>;
  searchTerms: Array<{
    term: string;
    count: number;
    samplePrompt?: string | null;
  }>;
  topEscalationTriggers: Array<{
    label: string;
    count: number;
    samplePrompt?: string | null;
  }>;
  trend: Array<{
    date: string;
    label: string;
    opens: number;
    messages: number;
    responses: number;
    fallbacks: number;
    avgResponseTimeMs: number | null;
  }>;
  comparison: {
    current: {
      conversations: number;
      activeUsers: number;
      fallbackRate: number;
      averageResponseTimeMs: number;
      opens: number;
      messages: number;
    };
    previous: {
      conversations: number;
      activeUsers: number;
      fallbackRate: number;
      averageResponseTimeMs: number;
      opens: number;
      messages: number;
    };
    delta: {
      conversations: number;
      activeUsers: number;
      fallbackRate: number;
      averageResponseTimeMs: number;
      opens: number;
      messages: number;
    };
  };
};

const assistantEventSelect = {
  id: true,
  userId: true,
  role: true,
  eventType: true,
  intent: true,
  label: true,
  contentSnippet: true,
  conversationId: true,
  messageId: true,
  pageKey: true,
  section: true,
  metadata: true,
  createdAt: true,
} satisfies Prisma.AiAssistantEventSelect;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private assistantTelemetryFallbackLogged = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async analytics() {
    const assistantWindowDays = 30;
    const assistantWindowStart = new Date();
    assistantWindowStart.setDate(
      assistantWindowStart.getDate() - assistantWindowDays,
    );

    const [
      totalUsers,
      totalClients,
      totalVendors,
      totalLeads,
      totalProjects,
      totalPayments,
      paidRevenue,
      leadsByStatus,
      projectsByStatus,
      proposals,
      contracts,
      projects,
      payments,
      tasks,
      staffUsers,
      vendors,
      leadAuditLogs,
      leadAssignments,
      assistantEvents,
      assistantConversations,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'CLIENT' } }),
      this.prisma.vendor.count(),
      this.prisma.lead.count(),
      this.prisma.project.count(),
      this.prisma.payment.count(),
      this.prisma.payment.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true },
      }),
      this.prisma.lead.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.project.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.proposal.findMany({
        where: { deletedAt: null },
      }),
      this.prisma.contract.findMany({
        where: { deletedAt: null },
      }),
      this.prisma.project.findMany({
        where: { deletedAt: null },
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
          assignments: {
            where: { isActive: true },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: { deletedAt: null },
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
      }),
      this.prisma.projectTask.findMany({
        where: { deletedAt: null },
      }),
      this.prisma.user.findMany({
        where: {
          role: {
            in: [Role.ADMIN, Role.SALES, Role.OPS, Role.FINANCE],
          },
          deletedAt: null,
        },
      }),
      this.prisma.vendor.findMany({
        where: { deletedAt: null },
        include: {
          assignments: true,
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          action: 'LEAD_CREATED',
          entityType: 'Lead',
        },
      }),
      this.prisma.leadAssignment.findMany({
        where: { isActive: true },
      }),
      this.findAssistantTelemetryEvents({
        createdAt: {
          gte: assistantWindowStart,
        },
      }),
      this.prisma.aiConversation.findMany({
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          isArchived: true,
          isPinned: true,
          createdAt: true,
          updatedAt: true,
          lastMessageAt: true,
          user: {
            select: {
              role: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),
    ]);

    const now = new Date();
    const overduePayments = payments.filter(
      (payment) =>
        payment.status === PaymentStatus.PENDING &&
        payment.dueDate &&
        payment.dueDate.getTime() < now.getTime(),
    );
    const revenueByPeriod = this.buildRevenueByPeriod(payments);
    const funnel = {
      leads: totalLeads,
      proposalsSent: proposals.filter(
        (proposal) =>
          proposal.status === 'SENT' || proposal.status === 'ACCEPTED',
      ).length,
      proposalsAccepted: proposals.filter(
        (proposal) => proposal.status === 'ACCEPTED',
      ).length,
      signedContracts: contracts.filter(
        (contract) => contract.status === 'SIGNED',
      ).length,
      activeProjects: projects.filter(
        (project) => !['COMPLETED', 'CANCELLED'].includes(project.status),
      ).length,
      completedProjects: projects.filter(
        (project) => project.status === 'COMPLETED',
      ).length,
      conversionRate:
        totalLeads === 0
          ? 0
          : Number(
              (
                (projects.filter(
                  (project) => !['CANCELLED'].includes(project.status),
                ).length /
                  totalLeads) *
                100
              ).toFixed(1),
            ),
    };
    const sourceTracking = this.buildLeadSourceTracking(leadAuditLogs);
    const completionMetrics = {
      completedProjects: funnel.completedProjects,
      totalProjects,
      completionRate:
        totalProjects === 0
          ? 0
          : Number(
              ((funnel.completedProjects / totalProjects) * 100).toFixed(1),
            ),
    };
    const upcomingWorkload = this.buildUpcomingWorkload(projects);
    const staffPerformance = staffUsers.map((user) => {
      const openTasks = tasks.filter(
        (task) =>
          task.assignedUserId === user.id &&
          task.status !== ProjectTaskStatus.DONE,
      ).length;
      const completedTasks = tasks.filter(
        (task) =>
          task.assignedUserId === user.id &&
          task.status === ProjectTaskStatus.DONE,
      ).length;

      return {
        id: user.id,
        name: user.name,
        role: user.role,
        activeLeadAssignments: leadAssignments.filter(
          (assignment) => assignment.userId === user.id,
        ).length,
        activeProjectAssignments: projects.filter((project) =>
          project.assignments.some(
            (assignment) => assignment.userId === user.id,
          ),
        ).length,
        openTasks,
        completedTasks,
      };
    });
    const vendorPerformance = vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      serviceType: vendor.serviceType,
      activeProjects: vendor.assignments.length,
      openTasks: tasks.filter(
        (task) =>
          task.assignedVendorId === vendor.id &&
          task.status !== ProjectTaskStatus.DONE,
      ).length,
      completedTasks: tasks.filter(
        (task) =>
          task.assignedVendorId === vendor.id &&
          task.status === ProjectTaskStatus.DONE,
      ).length,
    }));
    const assistant = this.buildAssistantAnalytics(
      assistantEvents,
      assistantConversations.map((conversation) => ({
        ...conversation,
        role: conversation.user.role,
        messageCount: conversation._count.messages,
      })),
      assistantWindowDays,
      {
        range: '30d',
        role: 'all',
        pageKey: null,
        search: null,
      },
    );

    return {
      totals: {
        users: totalUsers,
        clients: totalClients,
        vendors: totalVendors,
        leads: totalLeads,
        projects: totalProjects,
        payments: totalPayments,
        revenuePaid: paidRevenue._sum.amount ?? 0,
      },
      leadsByStatus,
      projectsByStatus,
      funnel,
      revenueByPeriod,
      overduePayments: {
        count: overduePayments.length,
        amount: overduePayments.reduce(
          (sum, payment) => sum + payment.amount,
          0,
        ),
        items: overduePayments.slice(0, 10),
      },
      sourceTracking,
      completionMetrics,
      upcomingWorkload,
      staffPerformance,
      vendorPerformance,
      assistant,
    };
  }

  async assistantAnalytics(query: AssistantAnalyticsQueryDto) {
    const range = query.range ?? '30d';
    const windowDays = range === '7d' ? 7 : 30;
    const assistantWindowEnd = new Date();
    const assistantWindowStart = new Date(assistantWindowEnd);
    assistantWindowStart.setDate(assistantWindowStart.getDate() - windowDays);
    const previousWindowStart = new Date(assistantWindowStart);
    previousWindowStart.setDate(previousWindowStart.getDate() - windowDays);
    const normalizedRole = query.role ?? 'all';
    const normalizedPageKey = query.pageKey?.trim() || null;
    const normalizedSearch = query.search?.trim() || null;

    const [events, conversations] = await Promise.all([
      this.findAssistantTelemetryEvents(
        {
          createdAt: {
            gte: previousWindowStart,
            lte: assistantWindowEnd,
          },
          ...(normalizedRole !== 'all' ? { role: normalizedRole as Role } : {}),
          ...(normalizedPageKey ? { pageKey: normalizedPageKey } : {}),
          ...(normalizedSearch
            ? {
                OR: [
                  {
                    contentSnippet: {
                      contains: normalizedSearch,
                      mode: 'insensitive',
                    },
                  },
                  {
                    label: {
                      contains: normalizedSearch,
                      mode: 'insensitive',
                    },
                  },
                  {
                    intent: {
                      contains: normalizedSearch,
                      mode: 'insensitive',
                    },
                  },
                ],
              }
            : {}),
        },
        { createdAt: 'asc' },
      ),
      this.prisma.aiConversation.findMany({
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          isArchived: true,
          isPinned: true,
          createdAt: true,
          updatedAt: true,
          lastMessageAt: true,
          user: {
            select: {
              role: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),
    ]);

    return this.buildAssistantAnalytics(
      events,
      conversations.map((conversation) => ({
        ...conversation,
        role: conversation.user.role,
        messageCount: conversation._count.messages,
      })),
      windowDays,
      {
        range,
        role: normalizedRole,
        pageKey: normalizedPageKey,
        search: normalizedSearch,
        currentWindowStart: assistantWindowStart,
        previousWindowStart,
        currentWindowEnd: assistantWindowEnd,
      },
    );
  }

  async pipeline() {
    const leads = await this.prisma.lead.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        client: true,
        proposals: {
          include: {
            contract: {
              include: {
                project: true,
              },
            },
          },
        },
        assignments: {
          where: {
            isActive: true,
          },
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
          orderBy: [{ role: 'asc' }, { startedAt: 'desc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return leads;
  }

  async systemOverview() {
    const [
      activeSessions,
      suspiciousSessions,
      pendingOtpChallenges,
      queueHealth,
      sessionRecords,
      unassignedProjects,
      overdueTasks,
      overduePayments,
    ] = await Promise.all([
      this.prisma.session.count({ where: { status: 'ACTIVE' } }),
      this.prisma.session.count({ where: { status: 'SUSPICIOUS' } }),
      this.prisma.otpChallenge.count({ where: { status: 'PENDING' } }),
      this.queueService.getQueueHealth(),
      this.prisma.session.findMany({
        where: { status: 'ACTIVE' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
              phone: true,
              email: true,
            },
          },
        },
        orderBy: { lastSeenAt: 'desc' },
        take: 20,
      }),
      this.prisma.project.count({
        where: {
          deletedAt: null,
          assignments: {
            none: {
              isActive: true,
            },
          },
        },
      }),
      this.prisma.projectTask.count({
        where: {
          deletedAt: null,
          status: {
            not: ProjectTaskStatus.DONE,
          },
          dueDate: {
            lt: new Date(),
          },
        },
      }),
      this.prisma.payment.count({
        where: {
          deletedAt: null,
          status: PaymentStatus.PENDING,
          dueDate: {
            lt: new Date(),
          },
        },
      }),
    ]);

    return {
      sessions: {
        active: activeSessions,
        suspicious: suspiciousSessions,
        records: sessionRecords,
      },
      otpChallenges: {
        pending: pendingOtpChallenges,
      },
      queues: queueHealth,
      pendingAlerts: {
        unassignedProjects,
        overdueTasks,
        overduePayments,
      },
    };
  }

  async revokeSession(sessionId: string, reason: string) {
    const session = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        suspiciousReason: reason,
      },
    });

    return {
      message: 'Session revoked.',
      sessionId: session.id,
    };
  }

  async listNotifications(userId: string) {
    return this.notificationsService.listForUser(userId, 50);
  }

  async markNotificationRead(userId: string, notificationId: string) {
    await this.notificationsService.markRead(userId, notificationId);
    return { success: true };
  }

  private async findAssistantTelemetryEvents(
    where: Prisma.AiAssistantEventWhereInput,
    orderBy: Prisma.AiAssistantEventOrderByWithRelationInput = {
      createdAt: 'asc',
    },
  ): Promise<AssistantAnalyticsEventRecord[]> {
    try {
      return await this.prisma.aiAssistantEvent.findMany({
        where,
        select: assistantEventSelect,
        orderBy,
      });
    } catch (error) {
      if (this.isMissingAssistantTelemetryTable(error)) {
        if (!this.assistantTelemetryFallbackLogged) {
          this.logger.warn(
            `Assistant telemetry table ${this.getMissingAssistantTelemetryTableName(error)} is unavailable yet; returning empty analytics until migrations are applied.`,
          );
          this.assistantTelemetryFallbackLogged = true;
        }

        return [];
      }

      throw error;
    }
  }

  private isMissingAssistantTelemetryTable(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2021'
    );
  }

  private getMissingAssistantTelemetryTableName(error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'meta' in error &&
      typeof (error as { meta?: { table?: unknown } }).meta?.table === 'string'
    ) {
      return `"${(error as { meta?: { table?: string } }).meta?.table}"`;
    }

    return 'the assistant telemetry table';
  }

  private buildRevenueByPeriod(
    payments: Array<{ paidAt: Date | null; amount: number; status: string }>,
  ) {
    const monthKeys = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index));
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    });

    const map = new Map(
      monthKeys.map((key) => [
        key,
        {
          period: key,
          paid: 0,
        },
      ]),
    );

    for (const payment of payments) {
      if (payment.status !== PaymentStatus.PAID || !payment.paidAt) {
        continue;
      }

      const key = `${payment.paidAt.getFullYear()}-${String(payment.paidAt.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) {
        continue;
      }

      map.get(key)!.paid += payment.amount;
    }

    return [...map.values()];
  }

  private formatAssistantDayKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private buildLeadSourceTracking(
    logs: Array<{ metadata: Prisma.JsonValue | null }>,
  ) {
    const result = new Map<string, number>();

    for (const log of logs) {
      const metadata = (log.metadata ?? {}) as Record<string, unknown>;
      const source =
        typeof metadata.source === 'string'
          ? metadata.source
          : typeof metadata.source === 'number' ||
              typeof metadata.source === 'boolean'
            ? String(metadata.source)
            : 'unknown';
      result.set(source, (result.get(source) ?? 0) + 1);
    }

    return [...result.entries()].map(([source, count]) => ({ source, count }));
  }

  private buildUpcomingWorkload(
    projects: Array<
      Prisma.ProjectGetPayload<{
        include: {
          contract: {
            include: {
              proposal: {
                include: {
                  lead: true;
                };
              };
            };
          };
          assignments: true;
        };
      }>
    >,
  ) {
    const now = new Date();
    const next30 = new Date();
    next30.setDate(next30.getDate() + 30);

    const relevant = projects.filter((project) => {
      const eventDate = project.contract.proposal.lead.eventDate;
      return eventDate >= now && eventDate <= next30;
    });

    const byCity = new Map<string, number>();
    for (const project of relevant) {
      const city = project.contract.proposal.lead.city ?? 'Unspecified';
      byCity.set(city, (byCity.get(city) ?? 0) + 1);
    }

    return {
      next7Days: relevant.filter((project) => {
        const upper = new Date();
        upper.setDate(upper.getDate() + 7);
        return project.contract.proposal.lead.eventDate <= upper;
      }).length,
      next30Days: relevant.length,
      byCity: [...byCity.entries()].map(([city, count]) => ({ city, count })),
    };
  }

  private buildAssistantAnalytics(
    events: AssistantAnalyticsEventRecord[],
    conversations: AssistantAnalyticsConversationRecord[],
    windowDays: number,
    filters?: {
      range: AssistantAnalyticsRange;
      role: AssistantAnalyticsRoleFilter;
      pageKey: string | null;
      search: string | null;
      currentWindowStart?: Date;
      previousWindowStart?: Date;
      currentWindowEnd?: Date;
    },
  ): AssistantAnalyticsSummary {
    const bookingQuestionIntents = new Set([
      'booking_inquiry',
      'booking_follow_up',
      'budget_discussion',
      'service_recommendation',
      'next_step_help',
      'pending_help',
    ]);
    const now = filters?.currentWindowEnd ?? new Date();
    const currentWindowStart =
      filters?.currentWindowStart ??
      (() => {
        const date = new Date(now);
        date.setDate(date.getDate() - windowDays);
        return date;
      })();
    const previousWindowStart =
      filters?.previousWindowStart ??
      (() => {
        const date = new Date(currentWindowStart);
        date.setDate(date.getDate() - windowDays);
        return date;
      })();

    const isWithinCurrentWindow = (date: Date) =>
      date.getTime() >= currentWindowStart.getTime() &&
      date.getTime() <= now.getTime();

    const isWithinPreviousWindow = (date: Date) =>
      date.getTime() >= previousWindowStart.getTime() &&
      date.getTime() < currentWindowStart.getTime();

    const currentEvents = events.filter((event) =>
      isWithinCurrentWindow(event.createdAt),
    );
    const previousEvents = events.filter((event) =>
      isWithinPreviousWindow(event.createdAt),
    );
    const currentMessageEvents = currentEvents.filter(
      (event) => event.eventType === 'message_received',
    );
    const currentResponseEvents = currentEvents.filter((event) =>
      ['response_sent', 'live_response_sent'].includes(event.eventType),
    );
    const currentFallbackEvents = currentEvents.filter(
      (event) => event.eventType === 'assistant_fallback',
    );
    const currentActionEvents = currentEvents.filter(
      (event) => event.eventType === 'action_clicked',
    );
    const currentOpenEvents = currentEvents.filter(
      (event) => event.eventType === 'assistant_opened',
    );
    const currentSearchEvents = currentEvents.filter(
      (event) => event.eventType === 'conversation_search',
    );

    const previousMessageEvents = previousEvents.filter(
      (event) => event.eventType === 'message_received',
    );
    const previousResponseEvents = previousEvents.filter((event) =>
      ['response_sent', 'live_response_sent'].includes(event.eventType),
    );
    const previousFallbackEvents = previousEvents.filter(
      (event) => event.eventType === 'assistant_fallback',
    );
    const previousOpenEvents = previousEvents.filter(
      (event) => event.eventType === 'assistant_opened',
    );

    const summarize = (
      source: AssistantAnalyticsEventRecord[],
      keySelector: (
        event: AssistantAnalyticsEventRecord,
      ) => string | null | undefined,
      sampleSelector?: (
        event: AssistantAnalyticsEventRecord,
      ) => string | null | undefined,
    ) => {
      const map = new Map<
        string,
        {
          count: number;
          intent: string | null;
          sample: string | null;
          pageKey: string | null;
        }
      >();

      for (const event of source) {
        const label = keySelector(event)?.trim() || 'unknown';
        const current = map.get(label) ?? {
          count: 0,
          intent: null,
          sample: null,
          pageKey: null,
        };

        current.count += 1;
        if (!current.intent && event.intent) {
          current.intent = event.intent;
        }

        if (!current.pageKey && event.pageKey) {
          current.pageKey = event.pageKey;
        }

        if (!current.sample && sampleSelector) {
          const sample = sampleSelector(event)?.trim() ?? '';
          if (sample) {
            current.sample = sample;
          }
        }

        map.set(label, current);
      }

      return [...map.entries()]
        .map(([label, value]) => ({
          label,
          count: value.count,
          intent: value.intent,
          sample: value.sample,
          pageKey: value.pageKey,
        }))
        .sort((left, right) => right.count - left.count);
    };

    const getMetadata = (event: AssistantAnalyticsEventRecord) =>
      event.metadata &&
      typeof event.metadata === 'object' &&
      !Array.isArray(event.metadata)
        ? (event.metadata as Record<string, unknown>)
        : null;

    const getText = (value: string | null | undefined) => value?.trim() ?? '';
    const getPromptLabel = (event: AssistantAnalyticsEventRecord) =>
      getText(event.contentSnippet) ||
      getText(event.label) ||
      getText(event.intent) ||
      'unknown';
    const getActionLabel = (event: AssistantAnalyticsEventRecord) => {
      const metadata = getMetadata(event);
      const actionType =
        typeof metadata?.actionType === 'string' ? metadata.actionType : null;

      return getText(event.label) || actionType || 'Action';
    };
    const getSearchLabel = (event: AssistantAnalyticsEventRecord) =>
      getText(event.contentSnippet) || getText(event.label) || 'unknown';

    const currentConversationIds = new Set(
      currentEvents
        .map((event) => event.conversationId)
        .filter((value): value is string => Boolean(value)),
    );
    const previousConversationIds = new Set(
      previousEvents
        .map((event) => event.conversationId)
        .filter((value): value is string => Boolean(value)),
    );
    const currentConversations = conversations.filter((conversation) =>
      currentConversationIds.has(conversation.id),
    );
    const previousConversations = conversations.filter((conversation) =>
      previousConversationIds.has(conversation.id),
    );

    const currentTotalMessages = currentConversations.reduce(
      (sum, conversation) => sum + conversation.messageCount,
      0,
    );
    const currentActiveUsers = new Set(
      currentEvents.map((event) => event.userId),
    ).size;
    const previousActiveUsers = new Set(
      previousEvents.map((event) => event.userId),
    ).size;

    const pairedResponseSamples = (source: AssistantAnalyticsEventRecord[]) => {
      const receivedByMessageId = new Map<
        string,
        { createdAt: Date; conversationId: string | null }
      >();
      const pendingByConversation = new Map<
        string,
        Array<{ createdAt: Date; conversationId: string | null }>
      >();
      const samples: Array<{ createdAt: Date; latencyMs: number }> = [];

      for (const event of source) {
        if (event.eventType === 'message_received') {
          if (event.messageId) {
            receivedByMessageId.set(event.messageId, {
              createdAt: event.createdAt,
              conversationId: event.conversationId,
            });
          }

          if (event.conversationId) {
            const queue = pendingByConversation.get(event.conversationId) ?? [];
            queue.push({
              createdAt: event.createdAt,
              conversationId: event.conversationId,
            });
            pendingByConversation.set(event.conversationId, queue);
          }

          continue;
        }

        if (
          !['response_sent', 'live_response_sent'].includes(event.eventType)
        ) {
          continue;
        }

        const received = event.messageId
          ? (receivedByMessageId.get(event.messageId) ?? null)
          : event.conversationId
            ? (pendingByConversation.get(event.conversationId)?.shift() ?? null)
            : null;

        if (!received) {
          continue;
        }

        const latencyMs =
          event.createdAt.getTime() - received.createdAt.getTime();
        if (latencyMs >= 0) {
          samples.push({
            createdAt: received.createdAt,
            latencyMs,
          });
        }
      }

      return samples;
    };

    const currentResponseSamples = pairedResponseSamples(currentEvents);
    const previousResponseSamples = pairedResponseSamples(previousEvents);
    const currentAverageResponseTimeMs = currentResponseSamples.length
      ? Number(
          (
            currentResponseSamples.reduce(
              (sum, sample) => sum + sample.latencyMs,
              0,
            ) / currentResponseSamples.length
          ).toFixed(0),
        )
      : 0;
    const previousAverageResponseTimeMs = previousResponseSamples.length
      ? Number(
          (
            previousResponseSamples.reduce(
              (sum, sample) => sum + sample.latencyMs,
              0,
            ) / previousResponseSamples.length
          ).toFixed(0),
        )
      : 0;

    const responseTimeLabel = (value: number) => {
      if (!value) {
        return '0 ms';
      }

      if (value < 1000) {
        return `${value} ms`;
      }

      const seconds = value / 1000;
      if (seconds < 60) {
        return `${seconds.toFixed(1)} s`;
      }

      const minutes = seconds / 60;
      return `${minutes.toFixed(1)} min`;
    };

    const responseEvents = currentResponseEvents;
    const fallbackEvents = currentFallbackEvents;
    const actionEvents = currentActionEvents;
    const messageEvents = currentMessageEvents;
    const openEvents = currentOpenEvents;

    const messageSamplesByIntent = new Map<string, string>();
    for (const event of messageEvents) {
      if (!event.intent || messageSamplesByIntent.has(event.intent)) {
        continue;
      }

      const sample = getText(event.contentSnippet);
      if (sample) {
        messageSamplesByIntent.set(event.intent, sample);
      }
    }

    const grouping = (
      source: AssistantAnalyticsEventRecord[],
      keySelector: (
        event: AssistantAnalyticsEventRecord,
      ) => string | null | undefined,
      sampleSelector?: (
        event: AssistantAnalyticsEventRecord,
      ) => string | null | undefined,
    ) =>
      summarize(source, keySelector, sampleSelector)
        .slice(0, 5)
        .map((item) => ({
          label: item.label,
          count: item.count,
          intent: item.intent,
          sample: item.sample,
          pageKey: item.pageKey,
        }));

    const totalMessages = currentTotalMessages;
    const activeConversations = currentConversations.filter(
      (conversation) => conversation.messageCount > 0,
    );
    const fallbackRate = responseEvents.length
      ? Number(
          ((fallbackEvents.length / responseEvents.length) * 100).toFixed(1),
        )
      : 0;
    const previousFallbackRate = previousResponseEvents.length
      ? Number(
          (
            (previousFallbackEvents.length / previousResponseEvents.length) *
            100
          ).toFixed(1),
        )
      : 0;

    const currentOpenCount = openEvents.length;
    const previousOpenCount = previousOpenEvents.length;
    const currentMessageCount = messageEvents.length;
    const previousMessageCount = previousMessageEvents.length;

    const currentSummary = {
      conversations: activeConversations.length,
      activeUsers: currentActiveUsers,
      fallbackRate,
      averageResponseTimeMs: currentAverageResponseTimeMs,
      opens: currentOpenCount,
      messages: currentMessageCount,
    };
    const previousSummary = {
      conversations: previousConversations.filter(
        (conversation) => conversation.messageCount > 0,
      ).length,
      activeUsers: previousActiveUsers,
      fallbackRate: previousFallbackRate,
      averageResponseTimeMs: previousAverageResponseTimeMs,
      opens: previousOpenCount,
      messages: previousMessageCount,
    };
    const delta = {
      conversations:
        currentSummary.conversations - previousSummary.conversations,
      activeUsers: currentSummary.activeUsers - previousSummary.activeUsers,
      fallbackRate: Number(
        (currentSummary.fallbackRate - previousSummary.fallbackRate).toFixed(1),
      ),
      averageResponseTimeMs:
        currentSummary.averageResponseTimeMs -
        previousSummary.averageResponseTimeMs,
      opens: currentSummary.opens - previousSummary.opens,
      messages: currentSummary.messages - previousSummary.messages,
    };

    const currentResponseTimesByDay = new Map<string, number[]>();
    for (const sample of currentResponseSamples) {
      const key = this.formatAssistantDayKey(sample.createdAt);
      const bucket = currentResponseTimesByDay.get(key) ?? [];
      bucket.push(sample.latencyMs);
      currentResponseTimesByDay.set(key, bucket);
    }

    const trend = Array.from({ length: windowDays }, (_, index) => {
      const date = new Date(currentWindowStart);
      date.setDate(date.getDate() + index);
      const key = this.formatAssistantDayKey(date);
      const dayEvents = currentEvents.filter(
        (event) => this.formatAssistantDayKey(event.createdAt) === key,
      );
      const responseSamples = currentResponseTimesByDay.get(key) ?? [];
      return {
        date: key,
        label: new Intl.DateTimeFormat('en-IN', {
          month: 'short',
          day: 'numeric',
        }).format(date),
        opens: dayEvents.filter(
          (event) => event.eventType === 'assistant_opened',
        ).length,
        messages: dayEvents.filter(
          (event) => event.eventType === 'message_received',
        ).length,
        responses: dayEvents.filter((event) =>
          ['response_sent', 'live_response_sent'].includes(event.eventType),
        ).length,
        fallbacks: dayEvents.filter(
          (event) => event.eventType === 'assistant_fallback',
        ).length,
        avgResponseTimeMs: responseSamples.length
          ? Number(
              (
                responseSamples.reduce((sum, value) => sum + value, 0) /
                responseSamples.length
              ).toFixed(0),
            )
          : null,
      };
    });

    const roleCounts = grouping(currentEvents, (event) => event.role);
    const pageUsageSource = openEvents.length
      ? openEvents
      : currentEvents.filter((event) => Boolean(event.pageKey));
    const pageCounts = grouping(
      pageUsageSource,
      (event) => event.pageKey ?? event.label ?? 'unknown',
      (event) => getText(event.contentSnippet),
    );
    const searchCounts = grouping(
      currentSearchEvents.length ? currentSearchEvents : messageEvents,
      (event) => getSearchLabel(event),
      (event) => getText(event.contentSnippet),
    );

    const fallbackConversationCounts = new Map<string, number>();
    for (const event of fallbackEvents) {
      if (!event.conversationId) {
        continue;
      }

      fallbackConversationCounts.set(
        event.conversationId,
        (fallbackConversationCounts.get(event.conversationId) ?? 0) + 1,
      );
    }
    const repeatedFallbackConversationIds = new Set(
      [...fallbackConversationCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([conversationId]) => conversationId),
    );

    const classifyEscalationTrigger = (
      event: AssistantAnalyticsEventRecord,
    ) => {
      const text =
        `${getText(event.contentSnippet)} ${getText(event.label)} ${getText(event.intent)}`
          .toLowerCase()
          .trim();

      if (
        event.intent === 'support_escalation' ||
        /\b(human|team|agent|admin|support|someone|person)\b/.test(text)
      ) {
        return 'Human handoff requested';
      }

      if (
        event.conversationId &&
        repeatedFallbackConversationIds.has(event.conversationId)
      ) {
        return 'Repeated fallback';
      }

      if (
        /\b(again|still|not working|wrong|frustrat|annoy|useless|doesn'?t|didn'?t|cannot|can't|cant)\b/.test(
          text,
        )
      ) {
        return 'Frustration detected';
      }

      if (
        /\b(auto[- ]?send|delete|refund|charge|cancel|export|sync|integrat|assign|remove|upload|change status)\b/.test(
          text,
        )
      ) {
        return 'Unsupported action requested';
      }

      return event.intent ? `Fallback: ${event.intent}` : 'General fallback';
    };

    const topEscalationTriggers = grouping(
      fallbackEvents,
      classifyEscalationTrigger,
      (event) => getText(event.contentSnippet),
    ).map((item) => ({
      label: item.label,
      count: item.count,
      samplePrompt: item.sample ?? null,
    }));

    const topIntents = grouping(
      messageEvents,
      (event) => event.intent ?? 'unknown',
      (event) => getText(event.contentSnippet),
    ).map((item) => ({
      label: item.label,
      count: item.count,
      samplePrompt: item.sample ?? null,
    }));
    const mostCommonPrompts = grouping(
      messageEvents,
      (event) => getPromptLabel(event),
      (event) => getText(event.contentSnippet),
    ).map((item) => ({
      label: item.label,
      count: item.count,
      intent: item.intent,
      samplePrompt: item.sample ?? null,
    }));
    const failedIntents = grouping(
      fallbackEvents,
      (event) => event.intent ?? 'unknown',
    ).map((item) => ({
      intent: item.label,
      count: item.count,
    }));
    const unansweredQuestions = grouping(
      fallbackEvents,
      (event) => event.intent ?? getPromptLabel(event),
      (event) => getText(event.contentSnippet),
    ).map((item) => ({
      intent: item.label,
      count: item.count,
      sampleQuestion: item.sample ?? null,
    }));
    const actionUsage = grouping(
      actionEvents,
      (event) => getActionLabel(event),
      (event) => getText(event.contentSnippet),
    ).map((item) => ({
      action: item.label,
      count: item.count,
    }));
    const bookingQuestions = grouping(
      messageEvents.filter(
        (event) => event.intent && bookingQuestionIntents.has(event.intent),
      ),
      (event) => event.intent ?? getPromptLabel(event),
      (event) => getText(event.contentSnippet),
    ).map((item) => ({
      intent: item.label,
      count: item.count,
      sampleQuestion:
        item.sample ?? messageSamplesByIntent.get(item.label) ?? null,
    }));

    const topUnansweredPrompts = grouping(
      fallbackEvents,
      (event) => getPromptLabel(event),
      (event) => getText(event.contentSnippet),
    ).map((item) => ({
      label: item.label,
      count: item.count,
      intent: item.intent,
      samplePrompt: item.sample ?? null,
      pageKey: item.pageKey,
    }));
    const topBookingPrompts = grouping(
      messageEvents.filter(
        (event) => event.intent && bookingQuestionIntents.has(event.intent),
      ),
      (event) => getPromptLabel(event),
      (event) => getText(event.contentSnippet),
    ).map((item) => ({
      label: item.label,
      count: item.count,
      intent: item.intent,
      samplePrompt: item.sample ?? null,
      pageKey: item.pageKey,
    }));
    const mostUsedActionButtons = grouping(
      actionEvents,
      (event) => getActionLabel(event),
      (event) => getText(event.contentSnippet),
    ).map((item) => ({
      label: item.label,
      count: item.count,
      samplePrompt: item.sample ?? null,
    }));

    const busiestHours = Array.from({ length: 24 }, (_, hour) => {
      const count = currentEvents.filter(
        (event) => event.createdAt.getHours() === hour,
      ).length;

      return {
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        count,
      };
    }).sort((left, right) => right.count - left.count);

    const topPages = pageCounts.map((item) => ({
      pageKey: item.label,
      label: item.sample ?? item.label,
      count: item.count,
      samplePrompt: item.sample ?? null,
    }));

    const pinnedConversations = currentConversations.filter(
      (conversation) => conversation.isPinned,
    ).length;
    const archivedConversations = currentConversations.filter(
      (conversation) => conversation.isArchived,
    ).length;

    return {
      windowDays,
      filters: {
        range: filters?.range ?? (windowDays === 7 ? '7d' : '30d'),
        role: filters?.role ?? 'all',
        pageKey: filters?.pageKey ?? null,
        search: filters?.search ?? null,
      },
      totalEvents: currentEvents.length,
      totalConversations: activeConversations.length,
      activeUsers: currentActiveUsers,
      averageThreadLength: activeConversations.length
        ? Number((totalMessages / activeConversations.length).toFixed(1))
        : 0,
      fallbackRate,
      averageResponseTimeMs: currentAverageResponseTimeMs,
      averageResponseTimeLabel: responseTimeLabel(currentAverageResponseTimeMs),
      pinnedConversations,
      archivedConversations,
      mostCommonPrompts,
      failedIntents,
      unansweredQuestions,
      actionUsage,
      bookingQuestions,
      topIntents,
      topUnansweredPrompts,
      topBookingPrompts,
      mostUsedActionButtons,
      busiestHours,
      topRoles: roleCounts.map((item) => ({
        role: item.label as Role,
        count: item.count,
      })),
      topPages,
      searchTerms: searchCounts.map((item) => ({
        term: item.label,
        count: item.count,
        samplePrompt: item.sample ?? null,
      })),
      topEscalationTriggers,
      trend,
      comparison: {
        current: currentSummary,
        previous: previousSummary,
        delta,
      },
    };
  }
}
