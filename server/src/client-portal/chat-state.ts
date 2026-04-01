import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ConversationThreadType,
  LeadStatus,
  MessageType,
  ProjectStatus,
  Role,
} from '@prisma/client';
import {
  CONVERSATION_TYPE_ORDER,
  type ConversationLifecycle,
  type LeadMessagingContext,
  type MessagingState,
  type PortalUser,
  STAFF_DIRECT_ROLES,
} from './client-portal.types';

export function buildMessagingState(lead: any): MessagingState {
  const latestProposal = lead.proposals[0] ?? null;
  const project = latestProposal?.contract?.project ?? null;
  const internalUsers = new Map<string, any>();

  for (const assignment of [
    ...(lead.assignments ?? []),
    ...(project?.assignments ?? []),
  ]) {
    if (assignment.user?.id) {
      internalUsers.set(assignment.user.id, assignment.user);
    }
  }

  const vendorUsers = new Map<string, any>();
  for (const assignment of project?.vendors ?? []) {
    const vendor = assignment.vendor;
    if (vendor?.userId) {
      vendorUsers.set(vendor.userId, {
        id: vendor.userId,
        name: vendor.name,
        phone: vendor.phone,
        email: vendor.email,
        role: Role.VENDOR,
        isActive: true,
        serviceType: vendor.serviceType,
      });
    }
  }

  return {
    latestProposal,
    project,
    participants: {
      client: lead.client ?? null,
      admins: Array.from(internalUsers.values()).filter(
        (user) => user.role === Role.ADMIN,
      ),
      staff: Array.from(internalUsers.values()).filter(
        (user) => user.role !== Role.ADMIN,
      ),
      vendors: Array.from(vendorUsers.values()),
    },
    lifecycle: resolveConversationLifecycle(lead, latestProposal, project),
  };
}

export function serializeMessages(
  messages: Array<any>,
  updates: Array<any>,
  conversationType: ConversationThreadType,
) {
  const systemMessages =
    conversationType === ConversationThreadType.GROUP
      ? updates.map((update) => ({
          id: `system-${update.id}`,
          type: MessageType.SYSTEM,
          body: update.body ?? update.title,
          sender: update.createdBy,
          createdAt: update.createdAt,
          attachmentName: null,
          attachmentKey: null,
          attachmentUrl: null,
          readAt: update.createdAt,
        }))
      : [];

  return [...messages, ...systemMessages]
    .map((message) => ({
      ...message,
      conversationType,
    }))
    .sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );
}

export function getConversationRecipientIds(
  context: LeadMessagingContext,
  actor: PortalUser,
  conversationType: ConversationThreadType,
) {
  return Array.from(
    new Set(
      getConversationParticipants(context, conversationType)
        .map((participant) => participant.id)
        .filter((participantId) => participantId !== actor.userId),
    ),
  );
}

export function resolveMessageActionUrl(
  role: Role,
  leadId: string,
  conversationType: ConversationThreadType,
) {
  const params = new URLSearchParams();
  params.set(role === Role.CLIENT ? 'bookingId' : 'leadId', leadId);
  params.set('conversationType', conversationType);

  if (role === Role.CLIENT) {
    return `/dashboard/chat?${params.toString()}`;
  }

  if (role === Role.ADMIN) {
    return `/admin/chat?${params.toString()}`;
  }

  if (role === Role.VENDOR) {
    return '/vendor';
  }

  return `/staff/chat?${params.toString()}`;
}

export function normalizeConversationType(
  conversationType: string | undefined,
  actor: PortalUser,
) {
  const normalized = conversationType?.trim().toUpperCase();

  if (!normalized) {
    return actor.role === Role.VENDOR
      ? ConversationThreadType.DIRECT_VENDOR
      : ConversationThreadType.GROUP;
  }

  if (
    normalized === ConversationThreadType.GROUP ||
    normalized === ConversationThreadType.DIRECT_ADMIN ||
    normalized === ConversationThreadType.DIRECT_STAFF ||
    normalized === ConversationThreadType.DIRECT_VENDOR
  ) {
    return normalized as ConversationThreadType;
  }

  throw new BadRequestException('Unsupported conversation type.');
}

export function ensureConversationAccess(
  context: LeadMessagingContext,
  actor: PortalUser,
  conversationType: ConversationThreadType,
) {
  if (!getVisibleConversationTypes(actor, context).includes(conversationType)) {
    throw new ForbiddenException(
      'You cannot access this booking conversation.',
    );
  }
}

export function ensureConversationWritable(lifecycle: ConversationLifecycle) {
  if (!lifecycle.canSend) {
    throw new BadRequestException(
      lifecycle.readOnlyMessage ?? 'Messaging is unavailable for this event.',
    );
  }
}

export function findThread(
  threads: Array<any>,
  conversationType: ConversationThreadType,
) {
  return threads.find((thread) => thread.type === conversationType) ?? null;
}

export function buildConversationSummaries(
  lead: any,
  actor: PortalUser,
  messagingState: MessagingState,
  unreadCountByThreadId = new Map<string, number>(),
) {
  return getVisibleConversationTypes(actor, messagingState).map(
    (conversationType) => {
      const thread = findThread(lead.threads, conversationType);
      const systemPreview =
        conversationType === ConversationThreadType.GROUP
          ? (serializeMessages(
              [],
              messagingState.project?.updates ?? [],
              conversationType,
            ).at(-1) ?? null)
          : null;
      const messagePreview = thread?.messages?.[0]
        ? serializeMessages([thread.messages[0]], [], conversationType)[0]
        : null;
      const lastMessage =
        systemPreview && messagePreview
          ? new Date(systemPreview.createdAt).getTime() >
            new Date(messagePreview.createdAt).getTime()
            ? systemPreview
            : messagePreview
          : (systemPreview ?? messagePreview);

      return {
        type: conversationType,
        label: getConversationLabel(conversationType),
        description: getConversationDescription(conversationType),
        unreadCount: thread ? (unreadCountByThreadId.get(thread.id) ?? 0) : 0,
        lastMessage,
        participants: getConversationParticipants(
          messagingState,
          conversationType,
        ),
      };
    },
  );
}

export function buildInboxWhere(actor: PortalUser) {
  if (actor.role === Role.CLIENT) {
    return {
      clientId: actor.userId,
      deletedAt: null,
    };
  }

  if (actor.role === Role.ADMIN) {
    return {
      deletedAt: null,
    };
  }

  if (actor.role === Role.VENDOR) {
    return {
      deletedAt: null,
      proposals: {
        some: {
          contract: {
            project: {
              vendors: {
                some: {
                  vendor: {
                    userId: actor.userId,
                    deletedAt: null,
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  return {
    deletedAt: null,
    OR: [
      {
        assignments: {
          some: {
            userId: actor.userId,
            isActive: true,
          },
        },
      },
      {
        proposals: {
          some: {
            contract: {
              project: {
                assignments: {
                  some: {
                    userId: actor.userId,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
      },
    ],
  };
}

export function findParticipantLabel(
  context: LeadMessagingContext,
  userId: string,
) {
  return [
    context.participants.client,
    ...context.participants.admins,
    ...context.participants.staff,
    ...context.participants.vendors,
  ]
    .filter(Boolean)
    .find((participant) => participant.id === userId)?.name;
}

function resolveConversationLifecycle(
  lead: { status: LeadStatus },
  proposal: any,
  project: any,
): ConversationLifecycle {
  if (
    project?.status === ProjectStatus.CANCELLED ||
    proposal?.status === 'REJECTED' ||
    proposal?.contract?.status === 'CANCELLED' ||
    lead.status === LeadStatus.LOST
  ) {
    return {
      status: 'CANCELLED',
      canSend: false,
      readOnlyMessage: 'This booking was cancelled. Messaging is now closed.',
    };
  }

  if (project?.status === ProjectStatus.COMPLETED) {
    return {
      status: 'COMPLETED',
      canSend: false,
      readOnlyMessage: 'This event has ended. Messaging is now closed.',
    };
  }

  return {
    status: 'ACTIVE',
    canSend: true,
    readOnlyMessage: null,
  };
}

function getVisibleConversationTypes(
  actor: PortalUser,
  messagingState: MessagingState,
) {
  const visible = new Set<ConversationThreadType>();
  const isAssignedAdmin = messagingState.participants.admins.some(
    (participant) => participant.id === actor.userId,
  );
  const isAssignedStaff = messagingState.participants.staff.some(
    (participant) => participant.id === actor.userId,
  );
  const isAssignedVendor = messagingState.participants.vendors.some(
    (participant) => participant.id === actor.userId,
  );

  if (actor.role === Role.CLIENT) {
    visible.add(ConversationThreadType.GROUP);
    if (messagingState.participants.admins.length) {
      visible.add(ConversationThreadType.DIRECT_ADMIN);
    }
    return CONVERSATION_TYPE_ORDER.filter((type) => visible.has(type));
  }

  if (actor.role === Role.VENDOR) {
    return isAssignedVendor ? [ConversationThreadType.DIRECT_VENDOR] : [];
  }

  if (isAssignedAdmin || isAssignedStaff) {
    visible.add(ConversationThreadType.GROUP);
  }

  if (isAssignedAdmin) {
    visible.add(ConversationThreadType.DIRECT_ADMIN);
  }

  if (
    (isAssignedAdmin || isAssignedStaff) &&
    STAFF_DIRECT_ROLES.includes(actor.role)
  ) {
    visible.add(ConversationThreadType.DIRECT_STAFF);
  }

  if (
    (isAssignedAdmin || isAssignedStaff) &&
    messagingState.participants.vendors.length
  ) {
    visible.add(ConversationThreadType.DIRECT_VENDOR);
  }

  return CONVERSATION_TYPE_ORDER.filter((type) => visible.has(type));
}

function getConversationParticipants(
  context: MessagingState,
  conversationType: ConversationThreadType,
) {
  if (conversationType === ConversationThreadType.DIRECT_ADMIN) {
    return [
      ...(context.participants.client ? [context.participants.client] : []),
      ...context.participants.admins,
    ];
  }

  if (conversationType === ConversationThreadType.DIRECT_STAFF) {
    return [...context.participants.admins, ...context.participants.staff];
  }

  if (conversationType === ConversationThreadType.DIRECT_VENDOR) {
    return [
      ...context.participants.admins,
      ...context.participants.staff,
      ...context.participants.vendors,
    ];
  }

  return [
    ...(context.participants.client ? [context.participants.client] : []),
    ...context.participants.admins,
    ...context.participants.staff,
  ];
}

function getConversationLabel(conversationType: ConversationThreadType) {
  if (conversationType === ConversationThreadType.DIRECT_ADMIN) {
    return 'Admin direct';
  }

  if (conversationType === ConversationThreadType.DIRECT_STAFF) {
    return 'Internal team';
  }

  if (conversationType === ConversationThreadType.DIRECT_VENDOR) {
    return 'Vendor coordination';
  }

  return 'Booking group';
}

function getConversationDescription(conversationType: ConversationThreadType) {
  if (conversationType === ConversationThreadType.DIRECT_ADMIN) {
    return 'Private support with your assigned admin contact.';
  }

  if (conversationType === ConversationThreadType.DIRECT_STAFF) {
    return 'Private planning for assigned staff and admins only.';
  }

  if (conversationType === ConversationThreadType.DIRECT_VENDOR) {
    return 'Private coordination with vendors and the internal team.';
  }

  return 'Shared booking updates for everyone on the event.';
}
