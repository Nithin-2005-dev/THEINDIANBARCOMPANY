import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationThreadType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { getChatUserSelect } from './client-portal.types';
import { buildMessagingState } from './chat-state';
import {
  DEFAULT_CONVERSATION_TYPES,
  DEFAULT_THREAD_WINDOW_LIMIT,
  type LeadMessagingContext,
  type PortalUser,
  type ThreadWindowQuery,
} from './client-portal.types';

@Injectable()
export class ClientPortalChatStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async resolveLeadMessagingContext(
    leadId: string,
    actor: PortalUser,
  ): Promise<LeadMessagingContext> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        client: {
          select: getChatUserSelect(),
        },
        threads: true,
        assignments: {
          where: { isActive: true },
          include: {
            user: {
              select: getChatUserSelect(),
            },
          },
        },
        proposals: {
          include: {
            contract: {
              include: {
                project: {
                  include: {
                    assignments: {
                      where: { isActive: true },
                      include: {
                        user: {
                          select: getChatUserSelect(),
                        },
                      },
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
                      orderBy: { createdAt: 'asc' },
                    },
                    vendors: {
                      include: {
                        vendor: {
                          select: {
                            id: true,
                            userId: true,
                            name: true,
                            phone: true,
                            email: true,
                            serviceType: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Event not found.');
    }

    await this.ensureDefaultConversationThreadsForLeadIds([lead.id]);

    const messagingState = buildMessagingState(lead);
    const internalParticipantIds = new Set([
      ...messagingState.participants.admins.map(
        (participant) => participant.id,
      ),
      ...messagingState.participants.staff.map((participant) => participant.id),
    ]);
    const vendorParticipantIds = new Set(
      messagingState.participants.vendors.map((participant) => participant.id),
    );
    const isAuthorized =
      lead.clientId === actor.userId ||
      internalParticipantIds.has(actor.userId) ||
      vendorParticipantIds.has(actor.userId);

    if (!isAuthorized) {
      throw new ForbiddenException('You cannot message on this event.');
    }

    return {
      lead,
      ...messagingState,
    };
  }

  async ensureDefaultConversationThreadsForLeadIds(leadIds: string[]) {
    const uniqueLeadIds = Array.from(new Set(leadIds.filter(Boolean)));
    if (!uniqueLeadIds.length) {
      return;
    }

    await this.prisma.conversationThread.createMany({
      data: uniqueLeadIds.flatMap((leadId) =>
        DEFAULT_CONVERSATION_TYPES.map((type) => ({
          leadId,
          type,
        })),
      ),
      skipDuplicates: true,
    });
  }

  async ensureConversationThread(
    leadId: string,
    conversationType: ConversationThreadType,
  ) {
    return this.prisma.conversationThread.upsert({
      where: {
        leadId_type: {
          leadId,
          type: conversationType,
        },
      },
      update: {},
      create: {
        leadId,
        type: conversationType,
      },
    });
  }

  async markThreadMessagesRead(
    threadId: string,
    leadId: string,
    reader: PortalUser,
    conversationType: ConversationThreadType,
  ) {
    const unreadMessages = await this.prisma.message.findMany({
      where: {
        threadId,
        senderId: { not: reader.userId },
        readAt: null,
      },
      select: {
        id: true,
        senderId: true,
      },
    });

    if (!unreadMessages.length) {
      return;
    }

    const readAt = new Date();

    await this.prisma.message.updateMany({
      where: {
        id: {
          in: unreadMessages.map((message) => message.id),
        },
      },
      data: {
        readAt,
      },
    });

    const senderIds = Array.from(
      new Set(
        unreadMessages
          .map((message) => message.senderId)
          .filter((senderId): senderId is string => Boolean(senderId)),
      ),
    );

    await this.realtimeService.publishToUsers(senderIds, 'message.read', {
      leadId,
      threadId,
      conversationType,
      messageIds: unreadMessages.map((message) => message.id),
      readAt: readAt.toISOString(),
      readBy: {
        id: reader.userId,
        role: reader.role,
      },
    });
  }

  resolveThreadWindowLimit(limit?: number) {
    if (!Number.isFinite(limit)) {
      return DEFAULT_THREAD_WINDOW_LIMIT;
    }

    return Math.min(
      Math.max(Number(limit) || DEFAULT_THREAD_WINDOW_LIMIT, 10),
      100,
    );
  }

  buildThreadMessageWhere(
    threadId: string,
    query: ThreadWindowQuery,
  ): Prisma.MessageWhereInput {
    const search = query.search?.trim();
    const hasValidDate = query.date && !Number.isNaN(Date.parse(query.date));
    const startDate = hasValidDate ? new Date(query.date as string) : null;
    const endDate = startDate ? new Date(startDate) : null;

    if (endDate) {
      endDate.setDate(endDate.getDate() + 1);
    }

    const andFilters: Prisma.MessageWhereInput[] = [{ threadId }];

    if (query.beforeCreatedAt && query.beforeId) {
      andFilters.push({
        OR: [
          {
            createdAt: {
              lt: new Date(query.beforeCreatedAt),
            },
          },
          {
            createdAt: new Date(query.beforeCreatedAt),
            id: {
              lt: query.beforeId,
            },
          },
        ],
      });
    }

    if (search) {
      andFilters.push({
        body: {
          contains: search,
          mode: 'insensitive',
        },
      });
    }

    if (startDate && endDate) {
      andFilters.push({
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      });
    }

    if (query.hasAttachment) {
      andFilters.push({
        OR: [
          {
            attachmentKey: {
              not: null,
            },
          },
          {
            attachmentUrl: {
              not: null,
            },
          },
        ],
      });
    }

    return andFilters.length === 1 ? andFilters[0] : { AND: andFilters };
  }
}
