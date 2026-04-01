import type { Role } from '@prisma/client';
import type {
  AssistantConversationMemory,
  AssistantExtractedEntities,
} from './assistant-engine.types';
import type { AssistantResponseStyle } from './assistant-response-style';
import { shouldUseStructuredReply } from './assistant-response-style';
import type { AssistantPromptSuggestion } from './assistant.types';

export function buildStructuredReply(input: {
  summary: string;
  details?: Array<string | null | undefined>;
  nextActions?: Array<string | null | undefined>;
}) {
  const details = (input.details ?? []).filter(Boolean);
  const nextActions = (input.nextActions ?? []).filter(Boolean);

  return [
    `Summary:\n${input.summary}`,
    details.length
      ? `Details:\n${details.map((line) => `- ${line}`).join('\n')}`
      : null,
    nextActions.length
      ? `Next actions:\n${nextActions.map((line) => `- ${line}`).join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildAssistantResponseContent(input: {
  style: AssistantResponseStyle;
  summary: string;
  details?: Array<string | null | undefined>;
  nextActions?: Array<string | null | undefined>;
}) {
  const details = (input.details ?? []).filter(Boolean);
  const nextActions = (input.nextActions ?? []).filter(Boolean);

  if (shouldUseStructuredReply(input.style)) {
    return buildStructuredReply({
      summary: input.summary,
      details,
      nextActions,
    });
  }

  if (!details.length) {
    return input.summary;
  }

  return `${input.summary} ${details[0]}`.trim();
}

export function buildBookingConversationContent(input: {
  serviceLabel?: string | null;
  budgetFit?: string | null;
  likelyInclusions: string[];
  missingDetails: string[];
  memory: AssistantConversationMemory;
  entities: AssistantExtractedEntities;
}) {
  const summaryBits = [
    input.memory.occasion,
    input.memory.venueType === 'office'
      ? 'office event'
      : input.memory.eventType,
    input.memory.guestCount ? `${input.memory.guestCount} guests` : null,
  ].filter(Boolean);
  const summary = input.serviceLabel
    ? `${summaryBits.length ? `${summaryBits.join(', ')} fits best under ${input.serviceLabel}.` : `${input.serviceLabel} is the best fit from what I have so far.`}`
    : 'I have enough detail to start narrowing the best-fit setup.';

  return buildStructuredReply({
    summary,
    details: [
      input.budgetFit ? `Estimated budget fit: ${input.budgetFit}` : null,
      input.memory.budgetPreference
        ? `Budget direction: ${input.memory.budgetPreference === 'lower' ? 'leaner setup' : 'more premium setup'}`
        : null,
      input.likelyInclusions.length
        ? `Likely inclusions: ${input.likelyInclusions.join(', ')}`
        : null,
      input.memory.city ? `Preferred city: ${input.memory.city}` : null,
      input.memory.location && input.memory.location !== input.memory.city
        ? `Location: ${input.memory.location}`
        : null,
      input.memory.indoorOutdoor
        ? `Venue direction: ${input.memory.indoorOutdoor}`
        : null,
      input.memory.venueType ? `Venue type: ${input.memory.venueType}` : null,
      input.memory.drinkRequirement
        ? `Drink setup: ${input.memory.drinkRequirement === 'dry' ? 'dry' : 'alcoholic'}`
        : null,
      input.memory.foodRequirement
        ? `Food requirement: ${input.memory.foodRequirement}`
        : null,
    ],
    nextActions: input.missingDetails
      .slice(0, 4)
      .map((detail) => `Share ${detail}`),
  });
}

export function buildContextualFallbackCopy(input: {
  role: Role;
  section: string;
  promptSuggestions: AssistantPromptSuggestion[];
  memory?: AssistantConversationMemory | null;
}) {
  const promptLabels = input.promptSuggestions
    .slice(0, 2)
    .map((suggestion) => `\`${suggestion.prompt}\``)
    .join(' or ');

  if (input.memory?.serviceRecommendation || input.memory?.guestCount) {
    const carryBits = [
      input.memory.occasion,
      input.memory.eventType,
      input.memory.guestCount ? `${input.memory.guestCount} guests` : null,
      input.memory.budgetText ? input.memory.budgetText : null,
    ].filter(Boolean);

    return `I still have the active event brief in mind${
      carryBits.length ? `: ${carryBits.join(', ')}` : ''
    }. I can tighten the fit, trim the budget, or move you into booking.`;
  }

  const copyBySection: Record<string, string> = {
    booking: 'I can help shape the brief, tighten the budget, and move this booking forward.',
    bookings: 'I can help spot blockers, pending items, and the next move on bookings.',
    contracts: 'I can help with contract stage, signature movement, and follow-up.',
    payments: 'I can help with pending payments, overdue items, and the fastest follow-up path.',
    projects: 'I can help with delivery status, ownership, and blocked work.',
    timeline: 'I can help with deadlines, updates, and anything that is slipping.',
    documents: 'I can help with missing uploads, latest versions, and what still needs attention.',
    chat: 'I can help with unread threads, reply drafts, and the right conversation.',
    notifications: 'I can help sort the latest alerts and the actions that need movement.',
    service: 'I can help compare the best fit and move you into booking.',
    home:
      input.role === 'ADMIN'
        ? 'I can help with overdue payments, unread chats, stalled bookings, contracts, and pending tasks.'
        : input.role === 'CLIENT'
          ? 'I can help with bookings, payments, contracts, unread chats, and the next step.'
          : input.role === 'VENDOR'
            ? 'I can help with assignments, schedules, payment release items, and delivery follow-up.'
            : 'I can help with assigned work, pending tasks, unread chats, and the next step.',
    general:
      input.role === 'CLIENT'
        ? 'I can guide your booking, payments, contracts, unread chats, and next steps.'
        : input.role === 'ADMIN'
          ? 'I can help with overdue payments, unread chats, stalled bookings, contracts, and pending tasks.'
          : input.role === 'VENDOR'
            ? 'I can help with schedules, assignments, payment release items, and delivery follow-up.'
            : 'I can help you triage bookings, projects, payments, contracts, and communication.',
  };

  const baseCopy = copyBySection[input.section] ?? copyBySection.general;

  return promptLabels ? `${baseCopy} Try ${promptLabels}.` : baseCopy;
}
