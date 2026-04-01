import type { Role } from '@prisma/client';
import type {
  AssistantClassification,
  AssistantConversationMemory,
  AssistantExtractedEntities,
} from './assistant-engine.types';
import {
  detectAssistantIdentityQuestion,
  detectCapabilityQuestion,
  detectFrustrationSignal,
  detectGreetingSignal,
  detectIdentityQuestion,
  detectOffTopicRequest,
  detectUnsupportedPersonalDataQuestion,
  detectUserIdentityQuestion,
  detectFollowUpSignal,
  detectUnsupportedRequest,
  normalizeAssistantText,
} from './assistant-language';

export type AssistantResponseStyle =
  | 'greeting'
  | 'identity'
  | 'capability'
  | 'direct_answer'
  | 'booking_recommendation'
  | 'clarification'
  | 'follow_up'
  | 'escalation'
  | 'unsupported_request'
  | 'summary'
  | 'draft'
  | 'action_result';

export type AssistantResponseTone =
  | 'warm'
  | 'direct'
  | 'concise'
  | 'supportive'
  | 'professional';

export type AssistantResponseChipStyle =
  | 'friendly'
  | 'identity'
  | 'capability'
  | 'status'
  | 'recommendation'
  | 'clarifying'
  | 'follow_up'
  | 'escalation'
  | 'unsupported'
  | 'summary'
  | 'draft'
  | 'result';

export type AssistantResponseLength = 'short' | 'medium' | 'long';

export type AssistantResponseStyleConfig = {
  tone: AssistantResponseTone;
  length: AssistantResponseLength;
  chipStyle: AssistantResponseChipStyle;
  format: 'plain' | 'structured';
  maxActions: number;
};

const ASSISTANT_RESPONSE_STYLES = [
  'greeting',
  'identity',
  'capability',
  'direct_answer',
  'booking_recommendation',
  'clarification',
  'follow_up',
  'escalation',
  'unsupported_request',
  'summary',
  'draft',
  'action_result',
] as const;

type AssistantResponseStyleInput = {
  message: string;
  classification: AssistantClassification;
  responseType?: string | null;
  memory?: AssistantConversationMemory | null;
  entities?: AssistantExtractedEntities | null;
  role?: Role;
  section?: string | null;
  pageKey?: string | null;
};

const STYLE_CONFIG: Record<AssistantResponseStyle, AssistantResponseStyleConfig> = {
  greeting: {
    tone: 'warm',
    length: 'short',
    chipStyle: 'friendly',
    format: 'plain',
    maxActions: 4,
  },
  identity: {
    tone: 'warm',
    length: 'short',
    chipStyle: 'identity',
    format: 'plain',
    maxActions: 3,
  },
  capability: {
    tone: 'professional',
    length: 'short',
    chipStyle: 'capability',
    format: 'plain',
    maxActions: 4,
  },
  direct_answer: {
    tone: 'direct',
    length: 'short',
    chipStyle: 'status',
    format: 'plain',
    maxActions: 3,
  },
  booking_recommendation: {
    tone: 'warm',
    length: 'medium',
    chipStyle: 'recommendation',
    format: 'structured',
    maxActions: 4,
  },
  clarification: {
    tone: 'concise',
    length: 'short',
    chipStyle: 'clarifying',
    format: 'plain',
    maxActions: 3,
  },
  follow_up: {
    tone: 'warm',
    length: 'short',
    chipStyle: 'follow_up',
    format: 'plain',
    maxActions: 3,
  },
  escalation: {
    tone: 'supportive',
    length: 'short',
    chipStyle: 'escalation',
    format: 'plain',
    maxActions: 3,
  },
  unsupported_request: {
    tone: 'direct',
    length: 'short',
    chipStyle: 'unsupported',
    format: 'plain',
    maxActions: 3,
  },
  summary: {
    tone: 'professional',
    length: 'medium',
    chipStyle: 'summary',
    format: 'structured',
    maxActions: 4,
  },
  draft: {
    tone: 'professional',
    length: 'medium',
    chipStyle: 'draft',
    format: 'structured',
    maxActions: 4,
  },
  action_result: {
    tone: 'direct',
    length: 'short',
    chipStyle: 'result',
    format: 'structured',
    maxActions: 4,
  },
};

const SUMMARY_RESPONSE_TYPES = new Set([
  'dashboard_snapshot',
  'operational_summary',
  'pending_tasks',
  'overdue_items',
  'upcoming_bookings',
  'blocked_bookings',
  'stalled_projects',
  'unread_items',
  'missing_assignments',
  'pending_approvals',
  'overdue_payments',
  'unsigned_contracts',
  'pending_summary',
  'payments_summary',
  'contract_summary',
  'unread_chat_summary',
  'entity_summary',
]);

const HAS_BOOKING_CONTEXT_KEYS = [
  'selectedBookingId',
  'selectedProjectId',
  'eventType',
  'occasion',
  'serviceSlug',
  'guestCount',
  'budgetAmount',
  'budgetPreference',
  'city',
  'location',
  'venueType',
  'indoorOutdoor',
  'foodRequirement',
  'drinkRequirement',
] as const;

export function getResponseStyleConfig(
  style: AssistantResponseStyle,
): AssistantResponseStyleConfig {
  return STYLE_CONFIG[style] ?? STYLE_CONFIG.direct_answer;
}

export function shouldUseStructuredReply(style: AssistantResponseStyle) {
  return getResponseStyleConfig(style).format === 'structured';
}

export function isAssistantResponseStyle(
  value: unknown,
): value is AssistantResponseStyle {
  return (
    typeof value === 'string' &&
    (ASSISTANT_RESPONSE_STYLES as readonly string[]).includes(value)
  );
}

export function classifyAssistantResponseStyle(
  input: AssistantResponseStyleInput,
): AssistantResponseStyle {
  const normalized = normalizeAssistantText(input.message);
  const responseType = input.responseType ?? null;
  const primaryIntent = input.classification.primaryIntent;
  const memory = input.memory ?? null;
  const memoryRecord = memory as Record<string, unknown> | null;
  const hasBookingContext = HAS_BOOKING_CONTEXT_KEYS.some((key) =>
    Boolean(memoryRecord?.[key]),
  );

  if (
    responseType === 'unsupported_request' ||
    primaryIntent === 'unsupported_request' ||
    primaryIntent === 'unsupported_personal_data' ||
    detectUnsupportedPersonalDataQuestion(normalized) ||
    detectUnsupportedRequest(normalized)
  ) {
    return 'unsupported_request';
  }

  if (
    responseType === 'escalation' ||
    primaryIntent === 'support_escalation' ||
    detectFrustrationSignal(normalized)
  ) {
    return 'escalation';
  }

  if (
    detectAssistantIdentityQuestion(normalized) ||
    detectIdentityQuestion(normalized) ||
    primaryIntent === 'assistant_identity' ||
    primaryIntent === 'user_identity'
  ) {
    return 'identity';
  }

  if (detectCapabilityQuestion(normalized)) {
    return 'capability';
  }

  if (
    primaryIntent === 'personal_question' ||
    primaryIntent === 'casual_chat' ||
    primaryIntent === 'off_topic' ||
    detectOffTopicRequest(normalized)
  ) {
    return 'direct_answer';
  }

  if (
    responseType === 'clarification' ||
    primaryIntent === 'clarification_request'
  ) {
    return 'clarification';
  }

  if (detectGreetingSignal(normalized) || primaryIntent === 'greeting') {
    return 'greeting';
  }

  if (
    responseType === 'draft_preview' ||
    primaryIntent === 'draft_request'
  ) {
    return 'draft';
  }

  if (responseType === 'booking_refinement') {
    return 'follow_up';
  }

  if (
    primaryIntent === 'booking_follow_up' ||
    (primaryIntent === 'budget_discussion' && hasBookingContext) ||
    (detectFollowUpSignal(normalized) && hasBookingContext)
  ) {
    return 'follow_up';
  }

  if (
    responseType === 'booking_consultation' ||
    primaryIntent === 'booking_inquiry' ||
    primaryIntent === 'service_recommendation' ||
    primaryIntent === 'budget_discussion'
  ) {
    return 'booking_recommendation';
  }

  if (responseType === 'page_overview') {
    return 'direct_answer';
  }

  if (
    responseType === 'next_step_help' ||
    responseType === 'navigation_request' ||
    responseType === 'action_request' ||
    responseType === 'workspace_search'
  ) {
    return 'action_result';
  }

  if (
    responseType &&
    SUMMARY_RESPONSE_TYPES.has(responseType)
  ) {
    return 'summary';
  }

  if (
    primaryIntent === 'summary_request' ||
    primaryIntent === 'operational_summary' ||
    primaryIntent === 'pending_tasks' ||
    primaryIntent === 'overdue_items' ||
    primaryIntent === 'upcoming_bookings' ||
    primaryIntent === 'blocked_bookings' ||
    primaryIntent === 'stalled_projects' ||
    primaryIntent === 'unread_items' ||
    primaryIntent === 'missing_assignments' ||
    primaryIntent === 'pending_approvals' ||
    primaryIntent === 'overdue_payments' ||
    primaryIntent === 'unsigned_contracts' ||
    primaryIntent === 'payment_help' ||
    primaryIntent === 'contract_help' ||
    primaryIntent === 'unread_messages_help' ||
    primaryIntent === 'assignments_help' ||
    primaryIntent === 'next_event_help' ||
    primaryIntent === 'pending_help'
  ) {
    return 'summary';
  }

  if (responseType === 'fallback') {
    return hasBookingContext || detectFollowUpSignal(normalized)
      ? 'follow_up'
      : 'direct_answer';
  }

  return 'direct_answer';
}
