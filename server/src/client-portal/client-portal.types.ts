import { ConversationThreadType, PaymentStatus, Role } from '@prisma/client';

export type PortalUser = {
  userId: string;
  role: Role;
  phone?: string | null;
  email?: string | null;
};

export type ConversationLifecycle = {
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  canSend: boolean;
  readOnlyMessage: string | null;
};

export type MessagingState = {
  latestProposal: any;
  project: any;
  participants: {
    client: any | null;
    admins: any[];
    staff: any[];
    vendors: any[];
  };
  lifecycle: ConversationLifecycle;
};

export type LeadMessagingContext = {
  lead: any;
} & MessagingState;

export type ThreadWindowQuery = {
  conversationType?: string;
  limit?: number;
  beforeCreatedAt?: string;
  beforeId?: string;
  search?: string;
  date?: string;
  hasAttachment?: boolean;
};

export type ThreadWindowResponse = {
  items: Array<any>;
  hasMore: boolean;
  nextCursor: {
    beforeCreatedAt: string;
    beforeId: string;
  } | null;
};

export const STAFF_DIRECT_ROLES: Role[] = [
  Role.ADMIN,
  Role.SALES,
  Role.OPS,
  Role.FINANCE,
];

export const CONVERSATION_TYPE_ORDER: ConversationThreadType[] = [
  ConversationThreadType.GROUP,
  ConversationThreadType.DIRECT_ADMIN,
  ConversationThreadType.DIRECT_STAFF,
  ConversationThreadType.DIRECT_VENDOR,
];

export const DEFAULT_CONVERSATION_TYPES: ConversationThreadType[] = [
  ConversationThreadType.GROUP,
  ConversationThreadType.DIRECT_ADMIN,
  ConversationThreadType.DIRECT_STAFF,
  ConversationThreadType.DIRECT_VENDOR,
];

export const DEFAULT_THREAD_WINDOW_LIMIT = 40;

export function isActionablePaymentStatus(status: PaymentStatus) {
  return status === PaymentStatus.PENDING || status === PaymentStatus.FAILED;
}

export function getChatUserSelect() {
  return {
    id: true,
    name: true,
    phone: true,
    email: true,
    role: true,
    isActive: true,
  } as const;
}
