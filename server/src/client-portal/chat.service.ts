import { Injectable } from '@nestjs/common';
import {
  ConversationThreadType,
  MessageType,
  NotificationType,
  Role,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { StorageService } from '../storage/storage.service';
import { CreateUploadUrlDto } from '../storage/dto/create-upload-url.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateTypingStatusDto } from './dto/update-typing-status.dto';
import {
  buildConversationSummaries,
  buildMessagingState,
  ensureConversationAccess,
  ensureConversationWritable,
  findParticipantLabel,
  findThread,
  getConversationRecipientIds,
  normalizeConversationType,
  resolveMessageActionUrl,
  serializeMessages,
} from './chat-state';
import { ClientPortalChatInboxService } from './chat-inbox.service';
import { ClientPortalChatStoreService } from './chat-store.service';
import {
  getChatUserSelect,
  type MessagingState,
  type PortalUser,
  type ThreadWindowQuery,
  type ThreadWindowResponse,
} from './client-portal.types';

@Injectable()
export class ClientPortalChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeService: RealtimeService,
    private readonly storageService: StorageService,
    private readonly chatStoreService: ClientPortalChatStoreService,
    private readonly chatInboxService: ClientPortalChatInboxService,
  ) {}

  async buildEventChatDetails(
    lead: any,
    actor: PortalUser,
    messagingState = buildMessagingState(lead),
  ) {
    await this.chatStoreService.ensureDefaultConversationThreadsForLeadIds([
      lead.id,
    ]);

    const groupThread =
      findThread(lead.threads, ConversationThreadType.GROUP) ??
      (await this.chatStoreService.ensureConversationThread(
        lead.id,
        ConversationThreadType.GROUP,
      ));

    if (groupThread) {
      await this.chatStoreService.markThreadMessagesRead(
        groupThread.id,
        lead.id,
        actor,
        ConversationThreadType.GROUP,
      );
    }

    return {
      status: messagingState.lifecycle.status,
      canSend: messagingState.lifecycle.canSend,
      readOnlyMessage: messagingState.lifecycle.readOnlyMessage,
      conversations: buildConversationSummaries(lead, actor, messagingState),
      messages: serializeMessages(
        groupThread?.messages ?? [],
        messagingState.project?.updates ?? [],
        ConversationThreadType.GROUP,
      ),
    };
  }

  async sendMessage(
    leadId: string,
    dto: CreateMessageDto,
    actor: PortalUser,
    conversationType?: string,
  ) {
    const context = await this.chatStoreService.resolveLeadMessagingContext(
      leadId,
      actor,
    );
    const normalizedConversationType = normalizeConversationType(
      conversationType,
      actor,
    );

    ensureConversationAccess(context, actor, normalizedConversationType);
    ensureConversationWritable(context.lifecycle);

    const thread = await this.chatStoreService.ensureConversationThread(
      leadId,
      normalizedConversationType,
    );
    const body = dto.body.trim();

    const message = await this.prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: actor.userId,
        type: MessageType.USER,
        body,
        attachmentName: dto.attachmentName,
        attachmentKey: dto.attachmentKey,
        attachmentUrl: dto.attachmentUrl,
      },
      include: {
        sender: {
          select: getChatUserSelect(),
        },
      },
    });

    const recipientIds = getConversationRecipientIds(
      context,
      actor,
      normalizedConversationType,
    );
    const recipients = await this.prisma.user.findMany({
      where: {
        id: {
          in: recipientIds,
        },
      },
      select: {
        id: true,
        role: true,
      },
    });

    await Promise.all(
      recipients.map((recipient) =>
        this.notificationsService.createInApp({
          userId: recipient.id,
          type: NotificationType.MESSAGE,
          title: 'New message received',
          body: body.slice(0, 120),
          actionUrl: resolveMessageActionUrl(
            recipient.role,
            leadId,
            normalizedConversationType,
          ),
          metadata: {
            leadId,
            messageId: message.id,
            conversationType: normalizedConversationType,
          },
        }),
      ),
    );

    await this.realtimeService.publishToUsers(recipientIds, 'message.created', {
      leadId,
      threadId: thread.id,
      conversationType: normalizedConversationType,
      message: serializeMessages([message], [], normalizedConversationType)[0],
    });

    return message;
  }

  async getThread(
    leadId: string,
    actor: PortalUser,
    conversationType?: string,
  ) {
    const context = await this.chatStoreService.resolveLeadMessagingContext(
      leadId,
      actor,
    );
    const normalizedConversationType = normalizeConversationType(
      conversationType,
      actor,
    );

    ensureConversationAccess(context, actor, normalizedConversationType);

    const thread = await this.chatStoreService.ensureConversationThread(
      leadId,
      normalizedConversationType,
    );

    await this.chatStoreService.markThreadMessagesRead(
      thread.id,
      context.lead.id,
      actor,
      normalizedConversationType,
    );

    const messages = await this.prisma.message.findMany({
      where: {
        threadId: thread.id,
      },
      include: {
        sender: {
          select: getChatUserSelect(),
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return serializeMessages(
      messages,
      normalizedConversationType === ConversationThreadType.GROUP
        ? (context.project?.updates ?? [])
        : [],
      normalizedConversationType,
    );
  }

  async getThreadWindow(
    leadId: string,
    actor: PortalUser,
    query: ThreadWindowQuery,
  ): Promise<ThreadWindowResponse> {
    const context = await this.chatStoreService.resolveLeadMessagingContext(
      leadId,
      actor,
    );
    const normalizedConversationType = normalizeConversationType(
      query.conversationType,
      actor,
    );

    ensureConversationAccess(context, actor, normalizedConversationType);

    const thread = await this.chatStoreService.ensureConversationThread(
      leadId,
      normalizedConversationType,
    );

    await this.chatStoreService.markThreadMessagesRead(
      thread.id,
      context.lead.id,
      actor,
      normalizedConversationType,
    );

    const take = this.chatStoreService.resolveThreadWindowLimit(query.limit);
    const where = this.chatStoreService.buildThreadMessageWhere(
      thread.id,
      query,
    );
    const messages = await this.prisma.message.findMany({
      where,
      include: {
        sender: {
          select: getChatUserSelect(),
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });

    const hasMore = messages.length > take;
    const windowMessages = hasMore ? messages.slice(0, take) : messages;
    const orderedMessages = [...windowMessages].reverse();
    const items = serializeMessages(
      orderedMessages,
      [],
      normalizedConversationType,
    );
    const nextCursor = hasMore
      ? {
          beforeCreatedAt:
            windowMessages[windowMessages.length - 1].createdAt.toISOString(),
          beforeId: windowMessages[windowMessages.length - 1].id,
        }
      : null;

    return {
      items,
      hasMore,
      nextCursor,
    };
  }

  async updateTypingStatus(
    leadId: string,
    dto: UpdateTypingStatusDto,
    actor: PortalUser,
    conversationType?: string,
  ) {
    const context = await this.chatStoreService.resolveLeadMessagingContext(
      leadId,
      actor,
    );
    const normalizedConversationType = normalizeConversationType(
      conversationType,
      actor,
    );

    ensureConversationAccess(context, actor, normalizedConversationType);

    if (dto.isTyping) {
      ensureConversationWritable(context.lifecycle);
    }

    const recipientIds = getConversationRecipientIds(
      context,
      actor,
      normalizedConversationType,
    ).filter((recipientId) => recipientId !== actor.userId);

    await this.realtimeService.publishToUsers(
      recipientIds,
      dto.isTyping ? 'typing.started' : 'typing.stopped',
      {
        leadId,
        conversationType: normalizedConversationType,
        actor: {
          id: actor.userId,
          role: actor.role,
          label:
            findParticipantLabel(context, actor.userId) ??
            actor.email ??
            actor.phone ??
            actor.role,
        },
      },
    );

    return { success: true };
  }

  async listInbox(actor: PortalUser) {
    return this.chatInboxService.listInbox(actor);
  }

  async createMessageAttachmentUploadUrl(
    leadId: string,
    dto: CreateUploadUrlDto,
    actor: PortalUser,
    conversationType?: string,
  ) {
    const context = await this.chatStoreService.resolveLeadMessagingContext(
      leadId,
      actor,
    );
    const normalizedConversationType = normalizeConversationType(
      conversationType,
      actor,
    );

    ensureConversationAccess(context, actor, normalizedConversationType);
    ensureConversationWritable(context.lifecycle);

    this.storageService.validateUpload(
      dto.contentType,
      dto.sizeBytes,
      this.storageService.getAttachmentAllowedTypes(),
    );

    const safeName = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
    const key = `messages/${leadId}/${normalizedConversationType}/${Date.now()}-${safeName}`;
    return this.storageService.createUploadUrl(key, dto.contentType);
  }
}
