import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildConversationSummaries,
  buildInboxWhere,
  buildMessagingState,
} from './chat-state';
import { ClientPortalChatStoreService } from './chat-store.service';
import { getChatUserSelect, type PortalUser } from './client-portal.types';

@Injectable()
export class ClientPortalChatInboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatStoreService: ClientPortalChatStoreService,
  ) {}

  async listInbox(actor: PortalUser) {
    const leads = await this.prisma.lead.findMany({
      where: buildInboxWhere(actor),
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
        proposals: {
          where: { deletedAt: null },
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
                      take: 1,
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
          take: 1,
        },
        threads: {
          include: {
            messages: {
              include: {
                sender: {
                  select: getChatUserSelect(),
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    await this.chatStoreService.ensureDefaultConversationThreadsForLeadIds(
      leads.map((lead) => lead.id),
    );

    const threadIds = leads.flatMap((lead) =>
      lead.threads.map((thread) => thread.id),
    );
    const unreadCounts =
      threadIds.length > 0
        ? await this.prisma.message.groupBy({
            by: ['threadId'],
            where: {
              threadId: { in: threadIds },
              senderId: { not: actor.userId },
              readAt: null,
            },
            _count: {
              _all: true,
            },
          })
        : [];
    const unreadCountByThreadId = new Map(
      unreadCounts.map((item) => [item.threadId, item._count._all]),
    );

    return leads
      .map((lead) => {
        const messagingState = buildMessagingState(lead);
        const conversations = buildConversationSummaries(
          lead,
          actor,
          messagingState,
          unreadCountByThreadId,
        );

        if (!conversations.length) {
          return null;
        }

        const lastMessage =
          conversations
            .map((conversation) => conversation.lastMessage)
            .filter(Boolean)
            .sort(
              (left, right) =>
                new Date(right.createdAt).getTime() -
                new Date(left.createdAt).getTime(),
            )[0] ?? null;

        return {
          id: lead.id,
          leadId: lead.id,
          title: messagingState.latestProposal?.title ?? lead.eventType,
          eventType: lead.eventType,
          packageName: lead.packageName,
          packageLabel: lead.packageLabel,
          eventDate: lead.eventDate,
          location: lead.location,
          client: lead.client,
          status: messagingState.lifecycle.status,
          canSend: messagingState.lifecycle.canSend,
          readOnlyMessage: messagingState.lifecycle.readOnlyMessage,
          participants: {
            client: messagingState.participants.client,
            admins: messagingState.participants.admins,
            staff: messagingState.participants.staff,
            vendors: messagingState.participants.vendors,
          },
          conversations,
          lastMessage,
          unreadCount: conversations.reduce(
            (sum, conversation) => sum + conversation.unreadCount,
            0,
          ),
          updatedAt: lastMessage?.createdAt ?? lead.updatedAt.toISOString(),
        };
      })
      .filter(Boolean)
      .sort(
        (left, right) =>
          new Date(right!.updatedAt).getTime() -
          new Date(left!.updatedAt).getTime(),
      );
  }
}
