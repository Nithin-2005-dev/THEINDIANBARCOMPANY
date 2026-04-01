export type AssistantWorkspaceRole = "admin" | "staff" | "vendor" | "client" | "public"

export type AssistantActionType =
  | "NAVIGATE"
  | "COPY_TEXT"
  | "APPLY_DRAFT"
  | "REFRESH"

export type AssistantAction = {
  id: string
  type: AssistantActionType
  label: string
  description?: string
  href?: string
  payload?: Record<string, unknown>
}

export type AssistantConversationContext = {
  pagePath?: string
  pageTitle?: string
  bookingId?: string
  leadId?: string
  projectId?: string
  metadata?: Record<string, unknown>
}

export type AssistantConversation = {
  id: string
  title: string
  preview: string | null
  messageCount: number
  isArchived: boolean
  archivedAt?: string | null
  isPinned: boolean
  pinnedAt?: string | null
  pagePath?: string | null
  pageTitle?: string | null
  lastMessageAt?: string | null
  createdAt: string
  updatedAt: string
}

export type AssistantMessage = {
  id: string
  actor: "USER" | "ASSISTANT" | "SYSTEM"
  role?: string | null
  content: string
  actions: AssistantAction[]
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export type AssistantPromptSuggestion = {
  id: string
  title: string
  prompt: string
  description?: string
}

export type AssistantTurnResponse = {
  conversation: AssistantConversation
  userMessage: AssistantMessage
  assistantMessage: AssistantMessage
}

export type AssistantLiveTurnResponse = {
  userMessage: AssistantMessage
  assistantMessage: AssistantMessage
}

export type AssistantAnalyticsEvent = {
  eventType: string
  conversationId?: string
  messageId?: string
  pageKey?: string
  section?: string
  intent?: string
  label?: string
  contentSnippet?: string
  metadata?: Record<string, unknown>
}
