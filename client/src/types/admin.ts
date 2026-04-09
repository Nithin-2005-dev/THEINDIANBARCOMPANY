import type { PortalInboxConversation } from "@/types/client-portal"

export type AdminRole = "ADMIN" | "SALES" | "OPS" | "FINANCE" | "CLIENT" | "VENDOR"
export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL_SENT"
  | "NEGOTIATING"
  | "WON"
  | "LOST"
export type ProposalStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED"
export type ContractStatus = "DRAFT" | "SENT" | "SIGNED" | "ARCHIVED" | "CANCELLED"
export type ProjectStatus =
  | "PLANNING"
  | "PREPARATION"
  | "EXECUTION"
  | "COMPLETED"
  | "CANCELLED"
export type PaymentType = "ADVANCE" | "MID" | "FINAL"
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED"
export type NotificationType =
  | "PROPOSAL"
  | "PAYMENT"
  | "STATUS"
  | "MESSAGE"
  | "EVENT"
  | "CONTRACT"
  | "GENERAL"

export type AdminUser = {
  id: string
  name?: string | null
  email?: string | null
  phone?: string | null
  role: AdminRole
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

export type Lead = {
  id: string
  eventType: string
  location: string
  city?: string | null
  eventDate: string
  guestCount?: number | null
  budgetMin?: number | null
  budgetMax?: number | null
  notes?: string | null
  status: LeadStatus
  createdAt: string
  updatedAt: string
  client: AdminUser
  proposals?: Proposal[]
  internalNotes?: LeadNote[]
  activities?: LeadActivity[]
  statusHistory?: LeadStatusHistory[]
  assignments?: StaffAssignment[]
}

export type LeadNote = {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  author?: AdminUser
}

export type LeadActivity = {
  id: string
  type: string
  description: string
  metadata?: Record<string, unknown> | null
  createdAt: string
  actor?: AdminUser | null
}

export type LeadStatusHistory = {
  id: string
  oldStatus?: LeadStatus | null
  newStatus: LeadStatus
  createdAt: string
  changedBy?: AdminUser | null
}

export type StaffAssignment = {
  id: string
  role: "PRIMARY" | "SUPPORTING"
  isActive: boolean
  notes?: string | null
  startedAt: string
  endedAt?: string | null
  user: AdminUser
  assignedBy?: AdminUser | null
  endedBy?: AdminUser | null
}

export type Proposal = {
  id: string
  leadId: string
  title: string
  price: number
  scope: string
  deliverables: string
  timeline: string
  notes?: string | null
  status: ProposalStatus
  createdAt: string
  updatedAt: string
  lead?: Lead
  contract?: Contract | null
}

export type Contract = {
  id: string
  proposalId: string
  documentUrl: string
  status: ContractStatus
  signedAt?: string | null
  signedByName?: string | null
  acceptedTermsAt?: string | null
  createdAt: string
  updatedAt: string
  proposal?: Proposal
  project?: Project | null
}

export type ContractTemplateField = {
  key: string
  label: string
  type: "text" | "textarea" | "date"
  required: boolean
  helperText?: string
  value: string
}

export type ContractTemplate = {
  id: string
  name: string
  description: string
  supportsNativeSignature: boolean
}

export type ContractTemplatePreview = {
  template: ContractTemplate
  title: string
  suggestedFileName: string
  html: string
  fields: ContractTemplateField[]
}

export type ContractVersion = {
  id: string
  version: number
  createdAt: string
  uploadedBy?: string | null
  uploadedByLabel: string
  accessUrl: string
  isCurrent: boolean
}

export type Vendor = {
  id: string
  name: string
  serviceType: string
  phone?: string | null
  email?: string | null
  pricingInfo?: string | null
  isAvailable: boolean
  notes?: string | null
  user?: AdminUser | null
  createdAt: string
  updatedAt: string
  assignments?: Array<{
    id: string
    projectId: string
    project: Project
  }>
}

export type Payment = {
  id: string
  projectId: string
  type: PaymentType
  status: PaymentStatus
  amount: number
  dueDate?: string | null
  currency: string
  gateway?: string
  gatewayOrderId?: string | null
  transactionId?: string | null
  receiptUrl?: string | null
  paidAt?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  project?: Project
}

export type Project = {
  id: string
  contractId: string
  clientId: string
  status: ProjectStatus
  progress: number
  summary?: string | null
  createdAt: string
  updatedAt: string
  client?: AdminUser
  contract?: Contract & {
    proposal?: Proposal & {
      lead?: Lead
    }
  }
  vendors?: Array<{
    id: string
    vendor: Vendor
  }>
  payments?: Payment[]
  assignments?: StaffAssignment[]
}

export type ProjectUpdate = {
  id: string
  projectId: string
  stage: "PLANNING" | "PREPARATION" | "READY" | "EVENT_DAY" | "COMPLETED"
  title: string
  body?: string | null
  isInternal: boolean
  createdAt: string
  createdBy?: AdminUser | null
}

export type PaginatedResponse<T> = {
  items: T[]
  meta: {
    page: number
    limit: number
    total: number
  }
}

export type AppNotification = {
  id: string
  type: NotificationType
  title: string
  body: string
  actionUrl?: string | null
  metadata?: Record<string, unknown> | null
  readAt?: string | null
  createdAt: string
}

export type EmailDeliveryStatus = "QUEUED" | "PROCESSING" | "RETRYING" | "SENT" | "FAILED"

export type EmailDeliveryLogEvent =
  | "QUEUED"
  | "PROCESSING"
  | "RETRY_SCHEDULED"
  | "SENT"
  | "FAILED"
  | "RESEND_REQUESTED"
  | "FORCE_SEND_REQUESTED"
  | "QUEUEING_FAILED"

export type AdminEmailDeliveryLog = {
  id: string
  event: EmailDeliveryLogEvent
  attemptNumber?: number | null
  jobId?: string | null
  message?: string | null
  details?: unknown
  createdAt: string
}

export type AdminEmailDelivery = {
  id: string
  status: EmailDeliveryStatus
  emailType: string
  template: string
  subject: string
  toEmail: string
  provider?: string | null
  providerMessageId?: string | null
  providerAcknowledgedAt?: string | null
  providerResponse?: unknown
  variables?: unknown
  metadata?: unknown
  recipientUserId?: string | null
  requestedById?: string | null
  leadId?: string | null
  projectId?: string | null
  paymentId?: string | null
  proposalId?: string | null
  contractId?: string | null
  retryCount: number
  maxRetries: number
  lastRetryAt?: string | null
  nextRetryAt?: string | null
  processingStartedAt?: string | null
  sentAt?: string | null
  failedAt?: string | null
  lastErrorMessage?: string | null
  lastErrorAt?: string | null
  allowManualResend: boolean
  isSensitive: boolean
  createdAt: string
  updatedAt: string
  recipientUser?: AdminUser | null
  requestedBy?: AdminUser | null
  logs: AdminEmailDeliveryLog[]
}

export type AdminEmailDeliverySummary = {
  total: number
  queued: number
  processing: number
  retrying: number
  sent: number
  failed: number
}

export type AdminEmailDeliveryListResponse = {
  items: AdminEmailDelivery[]
  meta: {
    page: number
    limit: number
    total: number
  }
  summary: AdminEmailDeliverySummary
  emailTypes: string[]
}

export type InboxThread = PortalInboxConversation

export type AdminAssistantInsight = {
  label: string
  count: number
  intent?: string | null
  samplePrompt?: string | null
}

export type AdminAssistantIntentInsight = {
  intent: string
  count: number
  sampleQuestion?: string | null
}

export type AdminAssistantUsageInsight = {
  action: string
  count: number
}

export type AdminAssistantTrendPoint = {
  date: string
  label: string
  opens: number
  messages: number
  responses: number
  fallbacks: number
  avgResponseTimeMs: number | null
}

export type AdminAssistantComparison = {
  current: {
    conversations: number
    activeUsers: number
    fallbackRate: number
    averageResponseTimeMs: number
    opens: number
    messages: number
  }
  previous: {
    conversations: number
    activeUsers: number
    fallbackRate: number
    averageResponseTimeMs: number
    opens: number
    messages: number
  }
  delta: {
    conversations: number
    activeUsers: number
    fallbackRate: number
    averageResponseTimeMs: number
    opens: number
    messages: number
  }
}

export type AdminAssistantPageInsight = {
  pageKey: string
  label: string
  count: number
  samplePrompt?: string | null
}

export type AdminAssistantSearchInsight = {
  term: string
  count: number
  samplePrompt?: string | null
}

export type AdminAssistantEscalationInsight = {
  label: string
  count: number
  samplePrompt?: string | null
}

export type AdminAssistantRoleInsight = {
  role: AdminRole
  count: number
}

export type AdminAssistantHourInsight = {
  hour: number
  label: string
  count: number
}

export type AdminAssistantFilterState = {
  range: "7d" | "30d"
  role: "all" | AdminRole
  pageKey: string | null
  search: string | null
}

export type AdminAssistantAnalytics = {
  windowDays: number
  filters?: AdminAssistantFilterState
  totalEvents: number
  totalConversations: number
  activeUsers: number
  averageThreadLength: number
  fallbackRate: number
  averageResponseTimeMs: number
  averageResponseTimeLabel: string
  pinnedConversations: number
  archivedConversations: number
  mostCommonPrompts: AdminAssistantInsight[]
  failedIntents: AdminAssistantIntentInsight[]
  unansweredQuestions: AdminAssistantIntentInsight[]
  actionUsage: AdminAssistantUsageInsight[]
  bookingQuestions: AdminAssistantIntentInsight[]
  topIntents?: Array<{
    label: string
    count: number
    samplePrompt?: string | null
  }>
  topUnansweredPrompts?: Array<{
    label: string
    count: number
    intent?: string | null
    samplePrompt?: string | null
    pageKey?: string | null
  }>
  topBookingPrompts?: Array<{
    label: string
    count: number
    intent?: string | null
    samplePrompt?: string | null
    pageKey?: string | null
  }>
  mostUsedActionButtons?: Array<{
    label: string
    count: number
    samplePrompt?: string | null
  }>
  busiestHours?: AdminAssistantHourInsight[]
  topRoles?: AdminAssistantRoleInsight[]
  topPages?: AdminAssistantPageInsight[]
  searchTerms?: AdminAssistantSearchInsight[]
  topEscalationTriggers?: AdminAssistantEscalationInsight[]
  trend?: AdminAssistantTrendPoint[]
  comparison?: AdminAssistantComparison
}

export type AdminAnalyticsResponse = {
  totals: {
    users: number
    clients: number
    vendors: number
    leads: number
    projects: number
    payments: number
    revenuePaid: number
  }
  leadsByStatus: Array<{
    status: LeadStatus
    _count: { _all: number }
  }>
  projectsByStatus: Array<{
    status: ProjectStatus
    _count: { _all: number }
  }>
  funnel?: {
    leads: number
    proposalsSent: number
    proposalsAccepted: number
    signedContracts: number
    activeProjects: number
    completedProjects: number
    conversionRate: number
  }
  revenueByPeriod?: Array<{
    period: string
    paid: number
  }>
  overduePayments?: {
    count: number
    amount: number
    items: Payment[]
  }
  sourceTracking?: Array<{
    source: string
    count: number
  }>
  completionMetrics?: {
    completedProjects: number
    totalProjects: number
    completionRate: number
  }
  upcomingWorkload?: {
    next7Days: number
    next30Days: number
    byCity: Array<{
      city: string
      count: number
    }>
  }
  staffPerformance?: Array<{
    id: string
    name?: string | null
    role: AdminRole
    activeLeadAssignments: number
    activeProjectAssignments: number
    openTasks: number
    completedTasks: number
  }>
  vendorPerformance?: Array<{
    id: string
    name: string
    serviceType: string
    activeProjects: number
    openTasks: number
    completedTasks: number
  }>
  assistant?: AdminAssistantAnalytics
}

export type AdminSystemOverview = {
  sessions: {
    active: number
    suspicious: number
    records?: Array<{
      id: string
      createdAt?: string
      lastSeenAt?: string
      user?: Pick<AdminUser, "id" | "name" | "phone" | "email" | "role">
      ipAddress?: string | null
      userAgent?: string | null
    }>
  }
  otpChallenges: {
    pending: number
  }
  queues: Record<string, unknown>
  pendingAlerts?: {
    unassignedProjects: number
    overdueTasks: number
    overduePayments: number
  }
}
