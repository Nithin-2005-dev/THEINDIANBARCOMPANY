import type {
  AssistantClassifierInput,
  AssistantClassification,
  AssistantIntent,
} from './assistant-engine.types';
import {
  ASSISTANT_SYNONYMS,
  detectAssistantIdentityQuestion,
  detectClarificationSignal,
  detectGreetingSignal,
  detectFrustrationSignal,
  detectFollowUpSignal,
  detectCasualChatQuestion,
  detectRepairSignal,
  detectBudgetPreference,
  detectChatSilence,
  detectOwnershipQuestion,
  detectPaymentRemainingQuestion,
  detectPendingAttentionSignal,
  detectPersonalQuestion,
  detectOffTopicRequest,
  detectServiceRecommendationQuestion,
  detectReminderRequest,
  detectUnsupportedPersonalDataQuestion,
  detectUnsupportedRequest,
  detectUserIdentityQuestion,
  detectPrivateCelebrationRequest,
  includesAnyPhrase,
  normalizeAssistantText,
  splitAssistantClauses,
} from './assistant-language';

const BOOKING_TERMS = ['booking', 'bookings', 'project', 'projects', 'brief', 'setup', 'package'];

const RECOMMENDATION_TERMS = [
  'which service is best',
  'which service should i choose',
  'which service should i use',
  'which service do you recommend',
  'which service would you recommend',
  'recommend',
  'recommended',
  'recommend a service',
  'suggest a service',
  'best fit',
  'best option',
  'best service',
  'best for',
  'fit my event',
  'compare',
  'comparison',
  'compare services',
  'compare setups',
  'service options',
  'service comparison',
  'premium',
  'expensive',
  'costly',
  'cheap',
  'cheaper',
  'affordable',
];

const SEARCH_TERMS = [
  'search',
  'search for',
  'look up',
  'lookup',
  'find all',
  'find my',
  'show all',
  'list all',
  'previous',
  'older',
  'history',
  'last',
  'earlier',
  'matching',
];

const SUMMARY_TERMS = ['summarize', 'summarise', 'summary', 'brief'];
const OPERATIONAL_SUMMARY_TERMS = [
  'operational summary',
  'ops summary',
  'operations summary',
  'give me an operational summary',
  'what needs attention',
  'what needs movement',
  'what am i missing',
  'dashboard briefing',
  'status briefing',
];
const PENDING_TASK_TERMS = [
  'current pending tasks',
  'pending tasks',
  'open tasks',
  'task queue',
  'task list',
  'show pending tasks',
];
const OVERDUE_ITEM_TERMS = [
  'overdue items',
  'what is overdue',
  'late items',
  'late work',
  'overdue work',
];
const UPCOMING_BOOKING_TERMS = [
  'upcoming bookings',
  'show upcoming bookings',
  'bookings needing attention',
  'upcoming bookings needing attention',
  'bookings next week',
  'bookings this week',
];
const BLOCKED_BOOKING_TERMS = [
  'blocked bookings',
  'show blocked bookings',
  'bookings blocked',
  'stuck bookings',
  'booking blocked',
  'what is blocked',
  'blocked',
];
const STALLED_PROJECT_TERMS = [
  'stalled projects',
  'show stalled projects',
  'quiet projects',
  'project delays',
  'slipping projects',
];
const UNREAD_ITEM_TERMS = [
  'unread items',
  'unread client chats',
  'unread chats',
  'unread messages',
  'show unread chats',
  'show unread messages',
];
const MISSING_ASSIGNMENT_TERMS = [
  'missing assignments',
  'missing staff',
  'unassigned bookings',
  'show unassigned bookings',
  'bookings without staff',
  'staff not assigned',
];
const PENDING_APPROVAL_TERMS = [
  'pending approvals',
  'pending approval',
  'awaiting approval',
  'needs approval',
  'awaiting decision',
  'proposal approval',
];
const OVERDUE_PAYMENT_TERMS = [
  'overdue payments',
  'show overdue payments',
  'pending payments',
  'unpaid invoices',
  'overdue invoices',
];
const UNSIGNED_CONTRACT_TERMS = [
  'unsigned contracts',
  'show unsigned contracts',
  'waiting on signature',
  'pending signature',
  'sent contracts',
];
const NEXT_STEP_TERMS = [
  'next step',
  'what next',
  'what should i do next',
  'what should i do',
  'what do i do next',
  'what needs attention',
  'what am i missing',
];
const NARRATIVE_ACTION_TERMS = [
  'open',
  'take me',
  'go to',
  'navigate',
  'view',
  'show me',
];

function hasBookingMemory(input: AssistantClassifierInput) {
  const memory = input.memory;
  return Boolean(
    memory?.selectedBookingId ||
    memory?.selectedProjectId ||
    memory?.eventType ||
    memory?.occasion ||
    memory?.serviceSlug ||
    memory?.guestCount ||
    memory?.budgetAmount ||
    memory?.budgetPreference ||
    memory?.city ||
    memory?.location ||
    memory?.venueType ||
    memory?.indoorOutdoor ||
    memory?.foodRequirement ||
    memory?.drinkRequirement,
  );
}

function hasBookingDetails(input: AssistantClassifierInput) {
  return Boolean(
    input.entities.occasion ||
    input.entities.guestCount ||
    input.entities.budgetAmount ||
    input.entities.budgetPreference ||
    input.entities.city ||
    input.entities.location ||
    input.entities.venueType ||
    input.entities.indoorOutdoor ||
    input.entities.foodRequirement ||
    input.entities.drinkRequirement,
  );
}

function isBookingDiscussion(input: AssistantClassifierInput, clause: string) {
  return (
    includesAnyPhrase(clause, BOOKING_TERMS) ||
    hasBookingDetails(input) ||
    Boolean(input.memory?.selectedBookingId || input.memory?.selectedProjectId)
  );
}

function isBudgetDiscussion(input: AssistantClassifierInput, clause: string) {
  return (
    includesAnyPhrase(clause, [
      ...ASSISTANT_SYNONYMS.budgetLower,
      ...ASSISTANT_SYNONYMS.budgetHigher,
      'budget',
      'price',
      'pricing',
      'cost',
      'quote',
      'lakh',
      'inr',
      'rs',
      'rupee',
      'rupees',
      'estimate',
    ]) ||
    Boolean(input.entities.budgetAmount) ||
    Boolean(input.entities.budgetPreference) ||
    Boolean(detectBudgetPreference(clause))
  );
}

function isPaymentDiscussion(input: AssistantClassifierInput, clause: string) {
  return (
    includesAnyPhrase(clause, ASSISTANT_SYNONYMS.payment) ||
    includesAnyPhrase(clause, [
      'overdue',
      'unpaid',
      'pending',
      'left to pay',
      'remaining',
      'balance',
      'due',
      'owed',
      'outstanding',
      'milestone',
      'receipt',
      'refund',
      'next payment',
      'remaining amount',
      'what is pending',
      'what is left',
    ]) ||
    Boolean(input.entities.paymentStatus) ||
    detectPaymentRemainingQuestion(clause)
  );
}

function isContractDiscussion(input: AssistantClassifierInput, clause: string) {
  return (
    includesAnyPhrase(clause, ASSISTANT_SYNONYMS.contract) ||
    Boolean(input.entities.contractStatus)
  );
}

function isChatDiscussion(input: AssistantClassifierInput, clause: string) {
  return (
    includesAnyPhrase(clause, ASSISTANT_SYNONYMS.chat) ||
    includesAnyPhrase(clause, ASSISTANT_SYNONYMS.unread) ||
    detectChatSilence(clause)
  );
}

function isAssignmentDiscussion(clause: string) {
  return (
    includesAnyPhrase(clause, ASSISTANT_SYNONYMS.owner) ||
    /\b(who is handling|who handles|who owns|assigned to|responsible for|coordinator)\b/.test(
      clause,
    )
  );
}

function isSearchDiscussion(clause: string) {
  return (
    includesAnyPhrase(clause, SEARCH_TERMS) ||
    (includesAnyPhrase(clause, ['show', 'find', 'list']) &&
      includesAnyPhrase(clause, [
        'bookings',
        'payments',
        'contracts',
        'projects',
        'chats',
        'messages',
        'notifications',
        'clients',
        'vendors',
        'conversations',
        'threads',
      ]))
  );
}

function isDraftDiscussion(clause: string) {
  return (
    includesAnyPhrase(clause, ['draft', 'write', 'compose', 'reply']) &&
    !includesAnyPhrase(clause, ['contract reminder', 'payment reminder'])
  );
}

function isNextStepDiscussion(clause: string) {
  return includesAnyPhrase(clause, NEXT_STEP_TERMS);
}

function isNavigationDiscussion(clause: string) {
  return includesAnyPhrase(clause, NARRATIVE_ACTION_TERMS);
}

function isServiceRecommendationDiscussion(clause: string) {
  return (
    detectServiceRecommendationQuestion(clause) ||
    (detectPrivateCelebrationRequest(clause) &&
      includesAnyPhrase(clause, [
        'best',
        'recommend',
        'suggest',
        'compare',
        'choose',
        'option',
        'service',
      ])) ||
    (includesAnyPhrase(clause, RECOMMENDATION_TERMS) &&
      !includesAnyPhrase(clause, ['book', 'booking', 'reserve', 'reservation']))
  );
}

function addScore(
  scores: Partial<Record<AssistantIntent, number>>,
  intent: AssistantIntent,
  value: number,
) {
  scores[intent] = (scores[intent] ?? 0) + value;
}

function addScoreIfMatched(
  scores: Partial<Record<AssistantIntent, number>>,
  clause: string,
  intent: AssistantIntent,
  phrases: string[],
  value: number,
) {
  if (includesAnyPhrase(clause, phrases)) {
    addScore(scores, intent, value);
  }
}

export function classifyAssistantInput(
  input: AssistantClassifierInput,
): AssistantClassification {
  const understanding = input.understanding ?? null;
  const normalized = normalizeAssistantText(
    understanding?.normalizedMessage ?? input.message,
  );
  const section =
    typeof input.context.metadata?.section === 'string'
      ? input.context.metadata.section
      : 'general';
  const clauses = splitAssistantClauses(normalized);
  const scores: Partial<Record<AssistantIntent, number>> = {};

  const repairSignal = detectRepairSignal(normalized);
  const clarificationSignal = detectClarificationSignal(normalized);
  const frustrationSignal = detectFrustrationSignal(normalized);
  const followUpSignal = detectFollowUpSignal(normalized);
  const hasExtractedDetails = hasBookingDetails(input);
  const hasActiveBookingContext = hasBookingMemory(input);

  if (understanding) {
    if (understanding.primaryIntent) {
      addScore(
        scores,
        understanding.primaryIntent,
        understanding.confidence >= 0.7 ? 6 : 3,
      );
    }

    for (const secondaryIntent of understanding.secondaryIntents.slice(0, 3)) {
      addScore(scores, secondaryIntent, 2);
    }

    if (understanding.queryType === 'booking') {
      addScore(
        scores,
        hasActiveBookingContext ? 'booking_follow_up' : 'booking_inquiry',
        4,
      );
    } else if (understanding.queryType === 'retrieval') {
      addScore(scores, 'search_request', 4);
    } else if (understanding.queryType === 'operational') {
      addScore(scores, 'operational_summary', 5);
    } else if (understanding.queryType === 'follow_up') {
      addScore(
        scores,
        hasActiveBookingContext ? 'booking_follow_up' : 'booking_inquiry',
        5,
      );
    } else if (understanding.queryType === 'clarification') {
      addScore(scores, 'clarification_request', 5);
    } else if (understanding.queryType === 'support') {
      addScore(scores, 'support_escalation', 5);
    } else if (understanding.queryType === 'unsupported') {
      addScore(scores, 'unsupported_request', 6);
    }

    if (understanding.frustration || understanding.sentiment === 'frustrated') {
      addScore(scores, 'support_escalation', 4);
    }

    if (understanding.clarificationNeeded) {
      addScore(scores, 'clarification_request', 3);
    }
  }

  if (detectGreetingSignal(normalized)) {
    addScore(scores, 'greeting', 4);
  }

  if (detectAssistantIdentityQuestion(normalized)) {
    addScore(scores, 'assistant_identity', 6);
  }

  if (detectUserIdentityQuestion(normalized)) {
    addScore(scores, 'user_identity', 6);
  }

  if (detectPersonalQuestion(normalized)) {
    addScore(scores, 'personal_question', 4);
  }

  if (detectCasualChatQuestion(normalized)) {
    addScore(scores, 'casual_chat', 5);
  }

  if (detectUnsupportedPersonalDataQuestion(normalized)) {
    addScore(scores, 'unsupported_personal_data', 6);
  }

  if (detectOffTopicRequest(normalized)) {
    addScore(scores, 'off_topic', 4);
  }

  if (
    /\b(what|how|why|when|where|who|explain|help|can you|could you)\b/.test(
      normalized,
    ) ||
    normalized.endsWith('?')
  ) {
    addScore(scores, 'informational_question', 2);
  }

  for (const clause of clauses) {
    if (detectUnsupportedRequest(clause)) {
      addScore(scores, 'unsupported_request', 6);
      continue;
    }

    const bookingSignal = isBookingDiscussion(input, clause);
    const budgetSignal = isBudgetDiscussion(input, clause);
    const paymentSignal = isPaymentDiscussion(input, clause);
    const contractSignal = isContractDiscussion(input, clause);
    const chatSignal = isChatDiscussion(input, clause);
    const assignmentSignal = isAssignmentDiscussion(clause);
    const searchSignal = isSearchDiscussion(clause);
    const draftSignal = isDraftDiscussion(clause);
    const nextStepSignal = isNextStepDiscussion(clause);
    const navigationSignal = isNavigationDiscussion(clause);
    const reminderSignal = detectReminderRequest(clause);
    const serviceRecommendationSignal = isServiceRecommendationDiscussion(
      clause,
    );

    if (serviceRecommendationSignal) {
      addScore(scores, 'service_recommendation', 6);
    }

    if (bookingSignal && !serviceRecommendationSignal) {
      addScore(scores, 'booking_inquiry', hasExtractedDetails ? 3 : 2);
    }

    if (
      hasActiveBookingContext &&
      (followUpSignal ||
        repairSignal ||
        hasExtractedDetails ||
        budgetSignal ||
        contractSignal ||
        paymentSignal ||
        chatSignal ||
        includesAnyPhrase(clause, ASSISTANT_SYNONYMS.cityShift) ||
        includesAnyPhrase(clause, ASSISTANT_SYNONYMS.indoor) ||
        includesAnyPhrase(clause, ASSISTANT_SYNONYMS.outdoor) ||
        includesAnyPhrase(clause, ASSISTANT_SYNONYMS.followUp))
    ) {
      addScore(scores, 'booking_follow_up', 4);
    }

    if (budgetSignal) {
      addScore(scores, 'budget_discussion', 4);
    }

    if (
      serviceRecommendationSignal ||
      Boolean(input.entities.serviceSlug && hasExtractedDetails)
    ) {
      addScore(scores, 'service_recommendation', 4);
    }

    if (paymentSignal) {
      addScore(scores, 'payment_help', 4);
    }

    if (searchSignal) {
      addScore(scores, 'search_request', 5);
    }

    if (includesAnyPhrase(clause, OPERATIONAL_SUMMARY_TERMS)) {
      addScore(scores, 'operational_summary', 5);
    }

    addScoreIfMatched(scores, clause, 'pending_tasks', PENDING_TASK_TERMS, 5);
    addScoreIfMatched(scores, clause, 'overdue_items', OVERDUE_ITEM_TERMS, 5);
    addScoreIfMatched(
      scores,
      clause,
      'upcoming_bookings',
      UPCOMING_BOOKING_TERMS,
      5,
    );
    addScoreIfMatched(
      scores,
      clause,
      'blocked_bookings',
      BLOCKED_BOOKING_TERMS,
      5,
    );
    addScoreIfMatched(
      scores,
      clause,
      'stalled_projects',
      STALLED_PROJECT_TERMS,
      5,
    );
    addScoreIfMatched(scores, clause, 'unread_items', UNREAD_ITEM_TERMS, 5);
    addScoreIfMatched(
      scores,
      clause,
      'missing_assignments',
      MISSING_ASSIGNMENT_TERMS,
      5,
    );
    addScoreIfMatched(
      scores,
      clause,
      'pending_approvals',
      PENDING_APPROVAL_TERMS,
      5,
    );
    addScoreIfMatched(
      scores,
      clause,
      'overdue_payments',
      OVERDUE_PAYMENT_TERMS,
      6,
    );
    addScoreIfMatched(
      scores,
      clause,
      'unsigned_contracts',
      UNSIGNED_CONTRACT_TERMS,
      6,
    );

    if (contractSignal) {
      addScore(scores, 'contract_help', 4);
    }

    if (chatSignal) {
      addScore(scores, 'unread_messages_help', 4);
    }

    if (
      includesAnyPhrase(clause, [
        'dashboard',
        'workspace',
        'overview',
        'home',
        'pending actions',
        'what can i do here',
      ]) ||
      (['general', 'home', 'notifications'].includes(section) &&
        includesAnyPhrase(clause, ['here', 'this page', 'this screen']))
    ) {
      addScore(scores, 'dashboard_help', 3);
    }

    if (navigationSignal) {
      addScore(scores, 'navigation_request', 4);
      addScore(scores, 'action_request', 2);
    }

    if (
      includesAnyPhrase(clause, [
        'manual booking',
        'book offline',
        'offline booking',
        'human help',
        'support escalation',
        'someone book for me',
      ])
    ) {
      addScore(scores, 'support_escalation', 5);
    }

    if (
      detectFrustrationSignal(clause) ||
      includesAnyPhrase(clause, [
        'talk to human',
        'talk to team',
        'contact support',
      ])
    ) {
      addScore(scores, 'support_escalation', 5);
    }

    if (
      detectPendingAttentionSignal(clause) ||
      includesAnyPhrase(clause, [
        'blocked',
        'stuck',
        'waiting',
        'what needs attention',
      ]) ||
      detectOwnershipQuestion(clause)
    ) {
      addScore(scores, 'pending_help', 4);
    }

    if (includesAnyPhrase(clause, SUMMARY_TERMS)) {
      addScore(scores, 'summary_request', 4);
    }

    if (assignmentSignal) {
      addScore(scores, 'assignments_help', 4);
    }

    if (nextStepSignal) {
      addScore(scores, 'next_step_help', 4);
    }

    if (draftSignal) {
      addScore(scores, 'draft_request', 4);
    }

    if (reminderSignal) {
      if (paymentSignal || input.entities.paymentStatus) {
        addScore(scores, 'payment_reminder_request', 5);
      } else if (chatSignal || assignmentSignal || contractSignal) {
        addScore(scores, 'draft_request', 4);
      } else {
        addScore(scores, 'draft_request', 4);
      }
    }

    if (includesAnyPhrase(clause, ['proposal', 'latest proposal', 'quote'])) {
      addScore(scores, 'proposal_help', 4);
    }

    if (
      includesAnyPhrase(clause, [
        'next event',
        'next assignment',
        'next booking',
      ])
    ) {
      addScore(scores, 'next_event_help', 4);
    }

    if (clarificationSignal) {
      addScore(scores, 'clarification_request', 5);
    }

    if (repairSignal) {
      addScore(scores, 'clarification_request', 2);
    }
  }

  if (repairSignal && input.memory?.lastPrimaryIntent) {
    addScore(scores, input.memory.lastPrimaryIntent, 4);
  }

  if (repairSignal && hasActiveBookingContext) {
    addScore(scores, 'booking_follow_up', 3);
  }

  if (hasExtractedDetails && !Object.keys(scores).length) {
    addScore(
      scores,
      hasActiveBookingContext ? 'booking_follow_up' : 'booking_inquiry',
      2,
    );
  }

  if (!Object.keys(scores).length) {
    if (
      ['bookings', 'projects', 'booking', 'service'].includes(section)
    ) {
      addScore(scores, 'dashboard_help', 1);
    } else if (repairSignal || clarificationSignal) {
      addScore(scores, 'clarification_request', 2);
    } else {
      addScore(scores, 'informational_question', 1);
    }
  }

  if (frustrationSignal) {
    addScore(scores, 'support_escalation', 4);
  }

  const matchedIntents = Object.entries(scores)
    .filter(([, score]) => (score ?? 0) > 0)
    .sort((left, right) => (right[1] ?? 0) - (left[1] ?? 0))
    .map(([intent]) => intent as AssistantIntent);

  const positiveScores = Object.values(scores).filter(
    (value): value is number => typeof value === 'number' && value > 0,
  );
  const scoreTotal = positiveScores.reduce((sum, value) => sum + value, 0);
  const topScore = positiveScores[0] ?? 0;
  const confidence =
    scoreTotal > 0 ? Number((topScore / scoreTotal).toFixed(2)) : 0;

  const primaryIntent = matchedIntents[0] ?? 'informational_question';
  const isMeaningful =
    normalized.length > 4 ||
    hasExtractedDetails ||
    matchedIntents.length > 1 ||
    repairSignal ||
    clarificationSignal ||
    frustrationSignal;

  return {
    primaryIntent,
    matchedIntents,
    scores,
    isMeaningful,
    confidence,
  };
}
