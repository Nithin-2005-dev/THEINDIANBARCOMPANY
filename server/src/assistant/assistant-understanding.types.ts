import type { Role } from '@prisma/client';
import type {
  AssistantConversationMemory,
  AssistantHistoryEntry,
  AssistantIntent,
} from './assistant-engine.types';

export type AssistantLlmUnderstandingQueryType =
  | 'booking'
  | 'retrieval'
  | 'operational'
  | 'follow_up'
  | 'clarification'
  | 'support'
  | 'unsupported'
  | 'general';

export type AssistantLlmUnderstandingSentiment =
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'frustrated';

export type AssistantLlmUnderstandingAmbiguity = 'low' | 'medium' | 'high';

export type AssistantLlmUnderstandingEntities = {
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
  paymentStatus?: string;
  contractStatus?: string;
  budgetPreference?: 'lower' | 'premium';
  asksForEstimate?: boolean;
  asksForComparison?: boolean;
  asksForDraft?: boolean;
};

export type AssistantLlmUnderstandingInput = {
  userMessage: string;
  role: Role;
  pageKey: string;
  section: string;
  pagePath?: string | null;
  pageTitle?: string | null;
  contextMetadata?: Record<string, unknown> | null;
  memory: AssistantConversationMemory | null;
  history: AssistantHistoryEntry[];
};

export type AssistantLlmUnderstandingOutput = {
  normalizedMessage: string;
  primaryIntent: AssistantIntent;
  secondaryIntents: AssistantIntent[];
  queryType: AssistantLlmUnderstandingQueryType;
  timeframe: string;
  clarificationNeeded: boolean;
  clarificationQuestion: string;
  followUpContext: string;
  language: string;
  sentiment: AssistantLlmUnderstandingSentiment;
  frustration: boolean;
  ambiguity: AssistantLlmUnderstandingAmbiguity;
  confidence: number;
  entities: AssistantLlmUnderstandingEntities;
};
