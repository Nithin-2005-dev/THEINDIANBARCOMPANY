export type PortalNotification = {
  id: string
  type: string
  title: string
  body: string
  actionUrl?: string | null
  readAt?: string | null
  createdAt: string
}

export type PortalDashboardResponse = {
  profile: {
    id: string
    name?: string | null
    phone?: string | null
    email?: string | null
  }
  overview: {
    upcomingEvents: PortalEventSummary[]
    activeCount: number
    completedCount: number
  }
  events: PortalEventSummary[]
  notifications: PortalNotification[]
}

export type PortalEventSummary = {
  id: string
  title: string
  eventType: string
  packageLabel?: string | null
  packageName?: string | null
  eventDate: string
  location: string
  status: string
  progress: number
  coordinator?: {
    id: string
    name?: string | null
    phone?: string | null
    email?: string | null
    role: string
  } | null
  paymentSummary: {
    total: number
    paid: number
    outstanding: number
    due?: {
      id: string
      amount: number
      currency: string
      dueDate?: string | null
      status: string
      type: string
    } | null
  }
  nextAction: {
    label: string
    path: string
  }
  timelinePreview: Array<{
    id: string
    kind: string
    title: string
    at: string
  }>
}

export type PortalContractVersion = {
  id: string
  version: number
  createdAt: string
  uploadedBy?: string | null
  uploadedByLabel: string
  accessUrl: string
  isCurrent: boolean
}

export type PortalConversationType =
  | "GROUP"
  | "DIRECT_ADMIN"
  | "DIRECT_STAFF"
  | "DIRECT_VENDOR"

export type PortalChatParticipant = {
  id: string
  name?: string | null
  phone?: string | null
  email?: string | null
  role: string
  isActive?: boolean | null
  serviceType?: string | null
}

export type PortalMessage = {
  id: string
  type: string
  body: string
  sender?: PortalChatParticipant | null
  attachmentName?: string | null
  attachmentKey?: string | null
  attachmentUrl?: string | null
  readAt?: string | null
  createdAt: string
  conversationType?: PortalConversationType
}

export type PortalConversationSummary = {
  type: PortalConversationType
  label: string
  description: string
  unreadCount: number
  lastMessage?: PortalMessage | null
  participants: PortalChatParticipant[]
}

export type PortalThreadPage = {
  items: PortalMessage[]
  hasMore: boolean
  nextCursor?: {
    beforeCreatedAt: string
    beforeId: string
  } | null
}

export type PortalInboxConversation = {
  id: string
  leadId: string
  title: string
  eventType: string
  packageLabel?: string | null
  packageName?: string | null
  eventDate: string
  location: string
  client: PortalChatParticipant
  status: "ACTIVE" | "COMPLETED" | "CANCELLED"
  canSend: boolean
  readOnlyMessage?: string | null
  participants: {
    client?: PortalChatParticipant | null
    admins: PortalChatParticipant[]
    staff: PortalChatParticipant[]
    vendors: PortalChatParticipant[]
  }
  conversations: PortalConversationSummary[]
  lastMessage?: PortalMessage | null
  unreadCount: number
  updatedAt: string
}

export type PortalEventDetailResponse = {
  lead: {
    id: string
    eventType: string
    location: string
    city?: string | null
    packageName?: string | null
    packageLabel?: string | null
    addOns: string[]
    eventDate: string
    guestCount?: number | null
    budgetMin?: number | null
    budgetMax?: number | null
    notes?: string | null
    status: string
  }
  proposal?: {
    id: string
    title: string
    price: number
    scope: string
    deliverables: string
    timeline: string
    notes?: string | null
    status: string
    documentUrl?: string | null
    clientComment?: string | null
  } | null
  contract?: {
    id: string
    documentUrl: string
    status: string
    signedAt?: string | null
    signedByName?: string | null
  } | null
  project?: {
    id: string
    status: string
    progress: number
    summary?: string | null
    payments: Array<{
      id: string
      type: string
      status: string
      amount: number
      currency: string
      dueDate?: string | null
      transactionId?: string | null
      gatewayOrderId?: string | null
      receiptUrl?: string | null
      paidAt?: string | null
      notes?: string | null
    }>
    visibleVendors: Array<{
      id: string
      name: string
      serviceType: string
    }>
    feedback?: {
      id: string
      rating: number
      testimonial?: string | null
      comments?: string | null
      allowMediaUsage: boolean
    } | null
  } | null
  coordinator?: {
    id: string
    name?: string | null
    phone?: string | null
    email?: string | null
    role: string
  } | null
  progress: {
    status: string
    percent: number
    stages: Array<{
      stage: string
      completed: boolean
    }>
  }
  chat: {
    status: "ACTIVE" | "COMPLETED" | "CANCELLED"
    canSend: boolean
    readOnlyMessage?: string | null
    conversations: PortalConversationSummary[]
  }
  timeline: Array<{
    id: string
    type: string
    title: string
    body?: unknown
    actor?: {
      id: string
      name?: string | null
      role?: string | null
    } | null
    createdAt: string
  }>
  messages: PortalMessage[]
}
