import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, ProjectStatus, Role } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { buildMessagingState } from './chat-state';
import { ClientPortalChatService } from './chat.service';
import { ClientPortalChatStoreService } from './chat-store.service';
import {
  buildStages,
  buildTimeline,
  resolveLifecycleStatus,
  resolveNextAction,
  resolveProgress,
} from './booking-presenter';
import {
  getChatUserSelect,
  isActionablePaymentStatus,
} from './client-portal.types';

@Injectable()
export class ClientPortalBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly chatService: ClientPortalChatService,
    private readonly chatStoreService: ClientPortalChatStoreService,
  ) {}

  async getDashboard(userId: string) {
    const [leads, notifications] = await Promise.all([
      this.prisma.lead.findMany({
        where: {
          clientId: userId,
          deletedAt: null,
        },
        include: {
          proposals: {
            where: { deletedAt: null },
            include: {
              contract: {
                include: {
                  project: {
                    include: {
                      payments: {
                        where: { deletedAt: null },
                        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
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
                            },
                          },
                        },
                        orderBy: { startedAt: 'asc' },
                      },
                      updates: {
                        where: { isInternal: false },
                        orderBy: { createdAt: 'desc' },
                        take: 5,
                      },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
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
                },
              },
            },
            orderBy: { startedAt: 'asc' },
          },
          activities: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              actor: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
          },
        },
        orderBy: { eventDate: 'asc' },
      }),
      this.notificationsService.listForUser(userId, 12),
    ]);

    await this.chatStoreService.ensureDefaultConversationThreadsForLeadIds(
      leads.map((lead) => lead.id),
    );

    const events = leads.map((lead) => {
      const latestProposal = lead.proposals[0] ?? null;
      const project = latestProposal?.contract?.project ?? null;
      const primaryAssignment =
        project?.assignments.find(
          (assignment) => assignment.role === 'PRIMARY',
        ) ??
        lead.assignments.find((assignment) => assignment.role === 'PRIMARY') ??
        null;
      const payments = project?.payments ?? [];
      const duePayment =
        payments.find((payment) => isActionablePaymentStatus(payment.status)) ??
        null;

      return {
        id: lead.id,
        title: latestProposal?.title ?? lead.eventType,
        eventType: lead.eventType,
        packageName: lead.packageName,
        packageLabel: lead.packageLabel,
        eventDate: lead.eventDate,
        location: lead.location,
        status: resolveLifecycleStatus(lead, latestProposal, project),
        progress: resolveProgress(project),
        coordinator: primaryAssignment?.user ?? null,
        paymentSummary: {
          total: payments.reduce((sum, payment) => sum + payment.amount, 0),
          paid: payments
            .filter((payment) => payment.status === PaymentStatus.PAID)
            .reduce((sum, payment) => sum + payment.amount, 0),
          outstanding: payments
            .filter((payment) => isActionablePaymentStatus(payment.status))
            .reduce((sum, payment) => sum + payment.amount, 0),
          due: duePayment,
        },
        nextAction: resolveNextAction(
          lead,
          latestProposal,
          project,
          duePayment?.id,
        ),
        timelinePreview: [
          ...(project?.updates ?? []).map((update) => ({
            id: update.id,
            kind: 'update',
            title: update.title,
            at: update.createdAt,
          })),
          ...lead.activities.map((activity) => ({
            id: activity.id,
            kind: 'activity',
            title: activity.description,
            at: activity.createdAt,
          })),
        ]
          .sort((left, right) => right.at.getTime() - left.at.getTime())
          .slice(0, 5),
      };
    });

    return {
      profile: await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      }),
      overview: {
        upcomingEvents: events.filter((event) => event.status !== 'COMPLETED'),
        activeCount: events.filter((event) => event.status !== 'COMPLETED')
          .length,
        completedCount: events.filter((event) => event.status === 'COMPLETED')
          .length,
      },
      events,
      notifications,
    };
  }

  async getEventDetails(leadId: string, userId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        clientId: userId,
        deletedAt: null,
      },
      include: {
        client: {
          select: getChatUserSelect(),
        },
        assignments: {
          where: { isActive: true },
          include: {
            user: {
              select: getChatUserSelect(),
            },
          },
          orderBy: { startedAt: 'asc' },
        },
        activities: {
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        proposals: {
          where: { deletedAt: null },
          include: {
            contract: {
              include: {
                project: {
                  include: {
                    payments: {
                      where: { deletedAt: null },
                      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
                    },
                    vendors: {
                      include: {
                        vendor: true,
                      },
                    },
                    assignments: {
                      where: { isActive: true },
                      include: {
                        user: {
                          select: getChatUserSelect(),
                        },
                      },
                      orderBy: { startedAt: 'asc' },
                    },
                    updates: {
                      where: { isInternal: false },
                      include: {
                        createdBy: {
                          select: {
                            id: true,
                            name: true,
                            role: true,
                          },
                        },
                      },
                      orderBy: { createdAt: 'desc' },
                    },
                    feedback: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        threads: {
          include: {
            messages: {
              include: {
                sender: {
                  select: getChatUserSelect(),
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Event not found.');
    }

    const messagingState = buildMessagingState(lead);
    const latestProposal = messagingState.latestProposal;
    const contract = latestProposal?.contract ?? null;
    const project = messagingState.project;
    const assignments = project?.assignments ?? lead.assignments;
    const coordinator =
      assignments.find((assignment) => assignment.role === 'PRIMARY')?.user ??
      null;
    const chatDetails = await this.chatService.buildEventChatDetails(
      lead,
      {
        userId,
        role: Role.CLIENT,
      },
      messagingState,
    );

    return {
      lead,
      proposal: latestProposal,
      contract,
      project: project
        ? {
            ...project,
            visibleVendors: project.vendors.map((assignment) => ({
              id: assignment.vendor.id,
              name: assignment.vendor.name,
              serviceType: assignment.vendor.serviceType,
            })),
          }
        : null,
      coordinator,
      progress: {
        status: resolveLifecycleStatus(lead, latestProposal, project),
        percent: resolveProgress(project),
        stages: buildStages(project),
      },
      timeline: buildTimeline({
        leadActivities: lead.activities,
        updates: project?.updates ?? [],
        payments: project?.payments ?? [],
        proposal: latestProposal,
        contract,
      }),
      chat: {
        status: chatDetails.status,
        canSend: chatDetails.canSend,
        readOnlyMessage: chatDetails.readOnlyMessage,
        conversations: chatDetails.conversations,
      },
      messages: chatDetails.messages,
    };
  }

  async submitFeedback(
    projectId: string,
    dto: SubmitFeedbackDto,
    userId: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        contract: {
          include: {
            proposal: true,
          },
        },
        feedback: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    if (project.clientId !== userId) {
      throw new ForbiddenException(
        'You cannot submit feedback for this event.',
      );
    }

    if (project.status !== ProjectStatus.COMPLETED) {
      throw new BadRequestException(
        'Feedback can only be submitted after event completion.',
      );
    }

    const feedback = await this.prisma.eventFeedback.upsert({
      where: { projectId },
      update: {
        rating: dto.rating,
        testimonial: dto.testimonial?.trim(),
        comments: dto.comments?.trim(),
        allowMediaUsage: dto.allowMediaUsage,
        submittedAt: new Date(),
      },
      create: {
        projectId,
        rating: dto.rating,
        testimonial: dto.testimonial?.trim(),
        comments: dto.comments?.trim(),
        allowMediaUsage: dto.allowMediaUsage,
      },
    });

    await this.notificationsService.createInApp({
      userId,
      type: 'GENERAL',
      title: 'Feedback submitted',
      body: 'Thank you for sharing your experience with The Indian Bar Company.',
      actionUrl: `/dashboard/events/${project.contract.proposal.leadId}`,
      metadata: {
        projectId,
        feedbackId: feedback.id,
      },
    });

    return feedback;
  }
}
