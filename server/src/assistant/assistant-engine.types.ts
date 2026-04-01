import type { ContractStatus, PaymentStatus, Role } from '@prisma/client';
import type { AssistantLlmUnderstandingOutput } from './assistant-understanding.types';
import type { AssistantContextInput } from './assistant.types';

export type AssistantIntent =
  | 'greeting'
  | 'informational_question'
  | 'assistant_identity'
  | 'user_identity'
  | 'personal_question'
  | 'casual_chat'
  | 'unsupported_personal_data'
  | 'off_topic'
  | 'operational_summary'
  | 'pending_tasks'
  | 'overdue_items'
  | 'upcoming_bookings'
  | 'blocked_bookings'
  | 'stalled_projects'
  | 'unread_items'
  | 'missing_assignments'
  | 'pending_approvals'
  | 'overdue_payments'
  | 'unsigned_contracts'
  | 'booking_inquiry'
  | 'booking_follow_up'
  | 'budget_discussion'
  | 'service_recommendation'
  | 'search_request'
  | 'payment_help'
  | 'contract_help'
  | 'unread_messages_help'
  | 'dashboard_help'
  | 'navigation_request'
  | 'support_escalation'
  | 'action_request'
  | 'pending_help'
  | 'summary_request'
  | 'assignments_help'
  | 'next_step_help'
  | 'draft_request'
  | 'payment_reminder_request'
  | 'proposal_help'
  | 'next_event_help'
  | 'clarification_request'
  | 'unsupported_request';

export type AssistantHistoryEntry = {
  actor: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt?: string;
};

export type AssistantExtractedEntities = {
  eventType?: string;
  occasion?: string;
  serviceSlug?: string | null;
  budgetAmount?: number;
  budgetText?: string;
  guestCount?: number;
  city?: string;
  location?: string;
  venueType?: string;
  indoorOutdoor?: 'indoor' | 'outdoor';
  foodRequirement?: string;
  drinkRequirement?: 'dry' | 'alcoholic';
  bookingStatus?: string;
  paymentStatus?: PaymentStatus | 'UNPAID' | 'OVERDUE';
  contractStatus?: ContractStatus;
  budgetPreference?: 'lower' | 'premium';
  selectedBookingId?: string;
  selectedProjectId?: string;
  currentPagePath?: string;
  currentPageTitle?: string;
  currentRole?: Role;
  asksForEstimate?: boolean;
  asksForComparison?: boolean;
  asksForDraft?: boolean;
};

export type AssistantConversationMemory = {
  currentRole?: Role;
  currentPagePath?: string;
  currentPageTitle?: string;
  selectedBookingId?: string;
  selectedProjectId?: string;
  lastSearchQuery?: string;
  eventType?: string;
  occasion?: string;
  serviceSlug?: string | null;
  serviceRecommendation?: string | null;
  guestCount?: number;
  budgetAmount?: number;
  budgetText?: string;
  city?: string;
  location?: string;
  venueType?: string;
  indoorOutdoor?: 'indoor' | 'outdoor';
  foodRequirement?: string;
  drinkRequirement?: 'dry' | 'alcoholic';
  budgetPreference?: 'lower' | 'premium';
  bookingStatus?: string;
  paymentStatus?: string;
  contractStatus?: string;
  lastPrimaryIntent?: AssistantIntent;
  meaningfulTurns?: number;
  fallbackCount?: number;
  lastFallbackAt?: string;
  lastFallbackIntent?: AssistantIntent;
  lastUpdatedAt?: string;
};

export type AssistantClassification = {
  primaryIntent: AssistantIntent;
  matchedIntents: AssistantIntent[];
  scores: Partial<Record<AssistantIntent, number>>;
  isMeaningful: boolean;
  confidence?: number;
};

export type AssistantClassifierInput = {
  message: string;
  context: AssistantContextInput;
  history: AssistantHistoryEntry[];
  memory?: AssistantConversationMemory | null;
  entities: AssistantExtractedEntities;
  understanding?: AssistantLlmUnderstandingOutput | null;
};

export type AssistantEntityExtractorInput = {
  message: string;
  context: AssistantContextInput;
  history: AssistantHistoryEntry[];
  role: Role;
  memory?: AssistantConversationMemory | null;
  understanding?: AssistantLlmUnderstandingOutput | null;
};
