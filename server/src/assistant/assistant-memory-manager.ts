import type { Role } from '@prisma/client';
import type {
  AssistantClassification,
  AssistantConversationMemory,
  AssistantExtractedEntities,
  AssistantHistoryEntry,
} from './assistant-engine.types';
import type { AssistantContextInput } from './assistant.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function toHistoryEntry(value: unknown): AssistantHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const actor =
    typeof value.actor === 'string' ? value.actor.toUpperCase() : null;
  const content = typeof value.content === 'string' ? value.content.trim() : '';
  const createdAt =
    typeof value.createdAt === 'string' ? value.createdAt : undefined;

  if (!actor || !content) {
    return null;
  }

  if (actor !== 'USER' && actor !== 'ASSISTANT' && actor !== 'SYSTEM') {
    return null;
  }

  return {
    actor: actor,
    content,
    createdAt,
  };
}

export function readAssistantMemory(
  metadata?: Record<string, unknown> | null,
): AssistantConversationMemory | null {
  if (!metadata || !isRecord(metadata.assistantMemory)) {
    return null;
  }

  return metadata.assistantMemory as AssistantConversationMemory;
}

export function getAssistantHistoryFromMetadata(
  metadata?: Record<string, unknown> | null,
) {
  if (!metadata || !Array.isArray(metadata.history)) {
    return [] as AssistantHistoryEntry[];
  }

  return metadata.history
    .map(toHistoryEntry)
    .filter(Boolean) as AssistantHistoryEntry[];
}

export function getAssistantHistoryFromMessages(
  messages: Array<{ actor: string; content: string; createdAt?: Date }>,
) {
  return messages
    .map((message) => ({
      actor: message.actor.toUpperCase(),
      content: message.content.trim(),
      createdAt: message.createdAt?.toISOString(),
    }))
    .map(toHistoryEntry)
    .filter(Boolean) as AssistantHistoryEntry[];
}

export function mergeAssistantMemory(input: {
  previous?: AssistantConversationMemory | null;
  context: AssistantContextInput;
  role: Role;
  entities: AssistantExtractedEntities;
  classification: AssistantClassification;
  serviceRecommendation?: string | null;
  bookingStatus?: string | null;
  paymentStatus?: string | null;
  contractStatus?: string | null;
}) {
  const previous = input.previous ?? null;
  const now = new Date().toISOString();
  const budgetAmount =
    input.entities.budgetAmount ?? input.previous?.budgetAmount ?? undefined;

  return {
    ...previous,
    currentRole: input.role,
    currentPagePath: input.context.pagePath ?? previous?.currentPagePath,
    currentPageTitle: input.context.pageTitle ?? previous?.currentPageTitle,
    lastSearchQuery: previous?.lastSearchQuery,
    selectedBookingId:
      input.context.leadId ??
      input.context.bookingId ??
      input.entities.selectedBookingId ??
      previous?.selectedBookingId,
    selectedProjectId:
      input.context.projectId ??
      input.entities.selectedProjectId ??
      previous?.selectedProjectId,
    eventType: input.entities.eventType ?? previous?.eventType,
    occasion: input.entities.occasion ?? previous?.occasion,
    serviceSlug: input.entities.serviceSlug ?? previous?.serviceSlug ?? null,
    serviceRecommendation:
      input.serviceRecommendation ??
      input.entities.serviceSlug ??
      previous?.serviceRecommendation ??
      null,
    guestCount: input.entities.guestCount ?? previous?.guestCount,
    budgetAmount,
    budgetText: input.entities.budgetText ?? previous?.budgetText,
    city: input.entities.city ?? previous?.city,
    location: input.entities.location ?? previous?.location,
    venueType: input.entities.venueType ?? previous?.venueType,
    indoorOutdoor: input.entities.indoorOutdoor ?? previous?.indoorOutdoor,
    foodRequirement:
      input.entities.foodRequirement ?? previous?.foodRequirement,
    drinkRequirement:
      input.entities.drinkRequirement ?? previous?.drinkRequirement,
    budgetPreference:
      input.entities.budgetPreference ?? previous?.budgetPreference,
    bookingStatus:
      input.bookingStatus ??
      input.entities.bookingStatus ??
      previous?.bookingStatus,
    paymentStatus:
      input.paymentStatus ??
      (input.entities.paymentStatus as string | undefined) ??
      previous?.paymentStatus,
    contractStatus:
      input.contractStatus ??
      (input.entities.contractStatus as string | undefined) ??
      previous?.contractStatus,
    lastPrimaryIntent: input.classification.primaryIntent,
    meaningfulTurns:
      (previous?.meaningfulTurns ?? 0) +
      (input.classification.isMeaningful ? 1 : 0),
    lastUpdatedAt: now,
  } satisfies AssistantConversationMemory;
}

export function buildAssistantMetadata(input: {
  existing?: Record<string, unknown>;
  history: AssistantHistoryEntry[];
  memory: AssistantConversationMemory;
  classification: AssistantClassification;
  entities: AssistantExtractedEntities;
  understanding?: Record<string, unknown> | null;
}) {
  return {
    ...(input.existing ?? {}),
    history: input.history.slice(-12),
    assistantMemory: input.memory,
    assistantUnderstanding: input.understanding ?? undefined,
    classification: {
      primaryIntent: input.classification.primaryIntent,
      matchedIntents: input.classification.matchedIntents,
      scores: input.classification.scores,
      confidence: input.classification.confidence,
    },
    entities: input.entities,
  } satisfies Record<string, unknown>;
}
