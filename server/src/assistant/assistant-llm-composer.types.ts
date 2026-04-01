import type { Role } from '@prisma/client';
import type {
  AssistantClassification,
  AssistantConversationMemory,
  AssistantExtractedEntities,
  AssistantHistoryEntry,
  AssistantIntent,
} from './assistant-engine.types';
import type { AssistantResponseStyle } from './assistant-response-style';
import type { AssistantAction } from './assistant.types';

export type AssistantLlmCompositionTone =
  | 'calm'
  | 'warm'
  | 'direct'
  | 'concise'
  | 'supportive'
  | 'professional';

export type AssistantLlmComposerInput = {
  userMessage: string;
  role: Role;
  intent: AssistantIntent;
  matchedIntents: AssistantClassification['matchedIntents'];
  confidence: number | null;
  responseType: string | null;
  responseStyle: AssistantResponseStyle | null;
  pageKey: string;
  section: string;
  pagePath?: string | null;
  pageTitle?: string | null;
  contextMetadata?: Record<string, unknown> | null;
  memory: AssistantConversationMemory | null;
  entities: AssistantExtractedEntities;
  history: AssistantHistoryEntry[];
  allowedActions: Array<
    Pick<AssistantAction, 'type' | 'label' | 'description' | 'href'>
  >;
  deterministicReply: string;
  responseMetadata?: Record<string, unknown> | null;
};

export type AssistantLlmComposerOutput = {
  summary: string;
  details: string[];
  nextActions: string[];
  clarificationQuestion: string;
  tone: AssistantLlmCompositionTone;
};
