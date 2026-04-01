import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AssistantIntent } from './assistant-engine.types';
import {
  createAssistantLlmCallDiagnostics,
  type AssistantLlmCallDiagnostics,
} from './assistant-llm-diagnostics';
import {
  detectCapabilityQuestion,
  detectFollowUpSignal,
  detectFrustrationSignal,
  detectGreetingSignal,
  detectIdentityQuestion,
  detectMultilingualSignal,
  detectPendingAttentionSignal,
  detectRepairSignal,
  detectUnsupportedRequest,
  detectSourceLanguage,
  includesAnyPhrase,
  normalizeAssistantText,
  splitAssistantClauses,
} from './assistant-language';
import type {
  AssistantLlmUnderstandingAmbiguity,
  AssistantLlmUnderstandingEntities,
  AssistantLlmUnderstandingInput,
  AssistantLlmUnderstandingOutput,
  AssistantLlmUnderstandingQueryType,
  AssistantLlmUnderstandingSentiment,
} from './assistant-understanding.types';

type OpenAIResponsesCreateResult = {
  output_text?: string | null;
  output?: Array<{
    type?: string;
    role?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const KNOWN_INTENTS = new Set<AssistantIntent>([
  'greeting',
  'informational_question',
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
  'booking_inquiry',
  'booking_follow_up',
  'budget_discussion',
  'service_recommendation',
  'search_request',
  'payment_help',
  'contract_help',
  'unread_messages_help',
  'dashboard_help',
  'navigation_request',
  'support_escalation',
  'action_request',
  'pending_help',
  'summary_request',
  'assignments_help',
  'next_step_help',
  'draft_request',
  'payment_reminder_request',
  'proposal_help',
  'next_event_help',
  'clarification_request',
  'unsupported_request',
]);

const UNDERSTANDING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'normalizedMessage',
    'primaryIntent',
    'secondaryIntents',
    'queryType',
    'timeframe',
    'clarificationNeeded',
    'clarificationQuestion',
    'followUpContext',
    'language',
    'sentiment',
    'frustration',
    'ambiguity',
    'confidence',
    'entities',
  ],
  properties: {
    normalizedMessage: { type: 'string' },
    primaryIntent: { type: 'string' },
    secondaryIntents: {
      type: 'array',
      items: { type: 'string' },
    },
    queryType: { type: 'string' },
    timeframe: { type: 'string' },
    clarificationNeeded: { type: 'boolean' },
    clarificationQuestion: { type: 'string' },
    followUpContext: { type: 'string' },
    language: { type: 'string' },
    sentiment: { type: 'string' },
    frustration: { type: 'boolean' },
    ambiguity: { type: 'string' },
    confidence: { type: 'number' },
    entities: {
      type: 'object',
      additionalProperties: false,
      properties: {
        eventType: { type: 'string' },
        occasion: { type: 'string' },
        serviceSlug: { type: 'string' },
        budgetAmount: { type: 'number' },
        budgetText: { type: 'string' },
        guestCount: { type: 'number' },
        city: { type: 'string' },
        location: { type: 'string' },
        venueType: { type: 'string' },
        indoorOutdoor: { type: 'string' },
        foodRequirement: { type: 'string' },
        drinkRequirement: { type: 'string' },
        bookingStatus: { type: 'string' },
        paymentStatus: { type: 'string' },
        contractStatus: { type: 'string' },
        budgetPreference: { type: 'string' },
        asksForEstimate: { type: 'boolean' },
        asksForComparison: { type: 'boolean' },
        asksForDraft: { type: 'boolean' },
      },
    },
  },
} as const;

@Injectable()
export class AssistantLlmUnderstandingService {
  private readonly logger = new Logger(AssistantLlmUnderstandingService.name);
  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxOutputTokens: number;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.getTrimmedEnv('OPENAI_API_KEY');
    this.model =
      this.getTrimmedEnv('OPENAI_UNDERSTANDING_MODEL') ??
      this.getTrimmedEnv('OPENAI_MODEL') ??
      'gpt-5-mini';
    this.baseUrl =
      this.getTrimmedEnv('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1';
    this.timeoutMs = this.getPositiveNumberEnv(
      'OPENAI_UNDERSTANDING_TIMEOUT_MS',
      this.getPositiveNumberEnv('OPENAI_RESPONSE_TIMEOUT_MS', 3500),
    );
    this.maxOutputTokens = this.getPositiveNumberEnv(
      'OPENAI_UNDERSTANDING_MAX_OUTPUT_TOKENS',
      320,
    );

    this.logStartupStatus();
  }

  isEnabled() {
    return Boolean(this.apiKey);
  }

  getModelName() {
    return this.model;
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  async understand(
    input: AssistantLlmUnderstandingInput,
    diagnostics?: AssistantLlmCallDiagnostics | null,
  ): Promise<AssistantLlmUnderstandingOutput | null> {
    const attemptDiagnostics =
      diagnostics ??
      createAssistantLlmCallDiagnostics({
        layer: 'understanding',
        apiKeyPresent: Boolean(this.apiKey),
        model: this.model,
        baseUrl: this.baseUrl,
      });

    const skipReason = this.getUnderstandingSkipReason(input);
    if (skipReason) {
      this.markDeterministicFallback(attemptDiagnostics, skipReason);
      this.logger.log(
        `OpenAI understanding skipped: called=false reason=${skipReason} source=deterministic model=${this.model} baseUrl=${this.baseUrl}`,
      );
      return null;
    }

    const startedAt = Date.now();
    this.markLlMInvocation(attemptDiagnostics);
    this.logger.log(
      `OpenAI understanding invoked: called=true model=${this.model} baseUrl=${this.baseUrl} timeoutMs=${this.timeoutMs} maxOutputTokens=${this.maxOutputTokens}`,
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.buildResponsesUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.buildRequest(input)),
        signal: controller.signal,
      });

      if (!response.ok) {
        const durationMs = Date.now() - startedAt;
        const errorMessage = await this.readResponseErrorMessage(response);
        this.markDeterministicFallback(
          attemptDiagnostics,
          `http_${response.status}`,
          response.status,
          errorMessage,
          durationMs,
        );
        this.logger.warn(
          `OpenAI understanding failed: called=true status=${response.status} durationMs=${durationMs} fallback=deterministic error=${errorMessage}`,
        );
        return null;
      }

      const payload = (await response.json()) as OpenAIResponsesCreateResult;
      const outputText = this.extractOutputText(payload);

      if (!outputText) {
        const durationMs = Date.now() - startedAt;
        this.markDeterministicFallback(
          attemptDiagnostics,
          'empty_output',
          null,
          null,
          durationMs,
        );
        this.logger.warn(
          `OpenAI understanding failed: called=true durationMs=${durationMs} fallback=deterministic error=empty_output`,
        );
        return null;
      }

      let parsedOutput: unknown;
      try {
        parsedOutput = JSON.parse(outputText) as unknown;
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const message = error instanceof Error ? error.message : 'unknown error';
        this.markDeterministicFallback(
          attemptDiagnostics,
          'invalid_json',
          null,
          message,
          durationMs,
        );
        this.logger.warn(
          `OpenAI understanding failed: called=true durationMs=${durationMs} fallback=deterministic error=invalid_json detail=${message}`,
        );
        return null;
      }

      const normalized = this.normalizeOutput(parsedOutput, input);
      if (!normalized) {
        const durationMs = Date.now() - startedAt;
        this.markDeterministicFallback(
          attemptDiagnostics,
          'normalized_output_rejected',
          null,
          null,
          durationMs,
        );
        this.logger.warn(
          `OpenAI understanding failed: called=true durationMs=${durationMs} fallback=deterministic error=normalized_output_rejected`,
        );
        return null;
      }

      const durationMs = Date.now() - startedAt;
      this.markLlMSuccess(
        attemptDiagnostics,
        durationMs,
        normalized.primaryIntent,
        normalized.queryType,
        normalized.language,
        normalized.confidence,
      );
      this.logger.log(
        `OpenAI understanding succeeded: called=true durationMs=${durationMs} source=llm intent=${normalized.primaryIntent} queryType=${normalized.queryType} language=${normalized.language} confidence=${normalized.confidence}`,
      );

      return normalized;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : 'unknown error';
      const isAbort = error instanceof Error && error.name === 'AbortError';
      this.markDeterministicFallback(
        attemptDiagnostics,
        isAbort ? 'timeout' : 'request_error',
        null,
        message,
        durationMs,
      );
      if (!isAbort) {
        this.logger.warn(
          `OpenAI understanding failed: called=true durationMs=${durationMs} fallback=deterministic error=${message}`,
        );
      } else {
        this.logger.warn(
          `OpenAI understanding failed: called=true durationMs=${durationMs} fallback=deterministic error=timeout`,
        );
      }

      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private getUnderstandingSkipReason(input: AssistantLlmUnderstandingInput) {
    if (!this.apiKey) {
      return 'missing_api_key';
    }

    const normalized = normalizeAssistantText(input.userMessage);
    if (!normalized) {
      return 'empty_message';
    }

    if (
      detectGreetingSignal(normalized) ||
      detectIdentityQuestion(normalized) ||
      detectCapabilityQuestion(normalized)
    ) {
      return 'greeting_identity_capability';
    }

    const clauseCount = splitAssistantClauses(normalized).length;
    const wordCount = normalized.split(/\s+/g).filter(Boolean).length;
    const looksLikeRetrieval = this.looksLikeRetrievalQuery(normalized);
    const looksLikeBookingBrief = this.looksLikeBookingBrief(normalized);
    const looksMultilingual = detectMultilingualSignal(normalized);
    const routineCommand = this.isRoutineOperationalCommand(normalized);
    const hasLinkingConjunction = /\b(and|also|plus|but|or|instead|rather)\b/.test(
      normalized,
    );

    if (
      routineCommand &&
      clauseCount === 1 &&
      wordCount <= 8 &&
      !hasLinkingConjunction
    ) {
      return 'routine_operational_command';
    }

    if (
      looksMultilingual ||
      detectFollowUpSignal(normalized) ||
      detectRepairSignal(normalized) ||
      detectPendingAttentionSignal(normalized) ||
      detectFrustrationSignal(normalized) ||
      detectUnsupportedRequest(normalized)
    ) {
      return null;
    }

    if (clauseCount > 1) {
      return null;
    }

    if (wordCount >= 12) {
      return looksLikeBookingBrief || looksLikeRetrieval
        ? null
        : 'not_llm_worthy';
    }

    return looksLikeBookingBrief || looksLikeRetrieval ? null : 'not_llm_worthy';
  }

  private shouldUseUnderstanding(input: AssistantLlmUnderstandingInput) {
    return this.getUnderstandingSkipReason(input) === null;
  }

  private isRoutineOperationalCommand(input: string) {
    return includesAnyPhrase(input, [
      'show overdue payments',
      'show overdue invoices',
      'show unread chats',
      'show unread messages',
      'show pending tasks',
      'show unsigned contracts',
      'what are the current pending tasks',
      'give me an operational summary',
      'what needs attention',
      'what is blocked',
      'what is overdue',
      'do i have unread client chats',
      'open contract',
      'open booking',
      'open payment',
      'show blocked bookings',
    ]);
  }

  private looksLikeRetrievalQuery(input: string) {
    return includesAnyPhrase(input, [
      'recent bookings',
      'latest bookings',
      'recent booking',
      'latest booking',
      'find the booking',
      'show me the booking',
      'show me the one',
      'which booking',
      'which contract',
      'which payment',
      'where the client',
      'what happened',
      'search for',
      'look up',
      'find the one',
    ]);
  }

  private looksLikeBookingBrief(input: string) {
    return includesAnyPhrase(input, [
      'event',
      'booking',
      'guest',
      'guests',
      'people',
      'pax',
      'budget',
      'snacks',
      'indoor',
      'outdoor',
      'office',
      'corporate',
      'private',
      'city',
      'location',
      'premium',
      'cheaper',
      'cheapest',
      'lower budget',
      'make it cheaper',
      'make it premium',
    ]);
  }

  private buildRequest(input: AssistantLlmUnderstandingInput) {
    const payload = this.buildPromptPayload(input);

    return {
      model: this.model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: this.buildSystemPrompt(),
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(payload, null, 2),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'beer_assistant_understanding',
          strict: true,
          schema: UNDERSTANDING_SCHEMA,
        },
      },
      max_output_tokens: this.maxOutputTokens,
      temperature: 0,
    };
  }

  private buildSystemPrompt() {
    return [
      'You are Beer, the understanding layer for a premium SaaS assistant.',
      'Your job is to interpret the message, not answer it.',
      'Normalize mixed-language input into plain English for internal reasoning.',
      'Keep normalizedMessage in plain English, even when the user wrote Hindi, Hinglish, Telugu, Tamil, Bengali, Kannada, Malayalam, or a mixed-language prompt.',
      'Preserve the operational meaning of common business words such as booking, payment, contract, chat, dashboard, unread, overdue, blocked, pending, task, project, staff, and city names.',
      'Set language to the user source language label, such as English, Hindi, Hinglish, Telugu, Tamil, Bengali, Kannada, Malayalam, or Mixed language.',
      'Identify the best intent, secondary intents, timeframe, language, sentiment, frustration, retrieval-vs-booking shape, ambiguity, and whether clarification is needed.',
      'Extract only the entities that are clearly present or strongly implied in the message and context.',
      'Do not invent permissions, record truth, counts, amounts, dates, or actions.',
      'Use the supplied payload only.',
      'If the message is simple and clear, keep ambiguity low and the normalized message short.',
      'Return JSON only that matches the schema.',
    ].join(' ');
  }

  private buildPromptPayload(input: AssistantLlmUnderstandingInput) {
    return {
      userMessage: input.userMessage,
      role: input.role,
      page: {
        path: input.pagePath ?? null,
        title: input.pageTitle ?? null,
        key: input.pageKey,
        section: input.section,
      },
      contextSignals: this.pickContextSignals(input.contextMetadata),
      memory: input.memory,
      history: input.history.slice(-8),
      messageSignals: this.buildMessageSignals(input.userMessage),
    };
  }

  private buildMessageSignals(message: string) {
    const normalized = normalizeAssistantText(message);
    const clauses = splitAssistantClauses(normalized);

    return {
      length: normalized.length,
      clauseCount: clauses.length,
      sourceLanguageHint: detectSourceLanguage(normalized),
      hasNonLatinScript:
        /[\u0900-\u097f\u0980-\u09ff\u0a00-\u0aff\u0b00-\u0bff\u0c00-\u0c7f\u0c80-\u0cff\u0d00-\u0d7f]/.test(
          normalized,
        ),
      multilingualSignal: detectMultilingualSignal(normalized),
      followUpSignal: detectFollowUpSignal(normalized),
      repairSignal: detectRepairSignal(normalized),
      pendingAttentionSignal: detectPendingAttentionSignal(normalized),
      frustrationSignal: detectFrustrationSignal(normalized),
      unsupportedSignal: detectUnsupportedRequest(normalized),
      greetingSignal: detectGreetingSignal(normalized),
      identitySignal: detectIdentityQuestion(normalized),
      capabilitySignal: detectCapabilityQuestion(normalized),
    };
  }

  private pickContextSignals(metadata?: Record<string, unknown> | null) {
    if (!metadata) {
      return null;
    }

    const picked = {
      currentTab: this.getString(metadata, 'currentTab'),
      currentView: this.getString(metadata, 'currentView'),
      searchTerm: this.getString(metadata, 'searchTerm'),
      filters:
        this.getSerializableValue(metadata, 'filters') ??
        this.getSerializableValue(metadata, 'filterState'),
      selectedBookingId: this.getString(metadata, 'selectedBookingId'),
      selectedLeadId: this.getString(metadata, 'selectedLeadId'),
      selectedProjectId: this.getString(metadata, 'selectedProjectId'),
      selectedPaymentId: this.getString(metadata, 'selectedPaymentId'),
      selectedContractId: this.getString(metadata, 'selectedContractId'),
      selectedChatThreadId: this.getString(metadata, 'selectedChatThreadId'),
      unreadChatCount: this.getNumber(metadata, 'unreadChatCount'),
      unreadNotificationCount: this.getNumber(
        metadata,
        'unreadNotificationCount',
      ),
      overduePaymentCount: this.getNumber(metadata, 'overduePaymentCount'),
      unsignedContractCount: this.getNumber(metadata, 'unsignedContractCount'),
      pendingTaskCount: this.getNumber(metadata, 'pendingTaskCount'),
      staffingGapCount: this.getNumber(metadata, 'staffingGapCount'),
      unassignedBookingCount: this.getNumber(
        metadata,
        'unassignedBookingCount',
      ),
      stalledProjectCount: this.getNumber(metadata, 'stalledProjectCount'),
      missingUploadCount: this.getNumber(metadata, 'missingUploadCount'),
      recentNotificationCount: this.getNumber(
        metadata,
        'recentNotificationCount',
      ),
      currentRole: this.getString(metadata, 'currentRole'),
    };

    return Object.fromEntries(
      Object.entries(picked).filter(([, value]) => value !== null),
    ) as Record<string, unknown>;
  }

  private extractOutputText(payload: OpenAIResponsesCreateResult) {
    if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
      return payload.output_text.trim();
    }

    const assistantMessage = payload.output?.find(
      (item) => item.type === 'message' && item.role === 'assistant',
    );

    if (!assistantMessage?.content?.length) {
      return null;
    }

    const text = assistantMessage.content
      .map((part) => (part.type === 'output_text' ? part.text ?? '' : ''))
      .join('')
      .trim();

    return text.length ? text : null;
  }

  private normalizeOutput(
    value: unknown,
    input: AssistantLlmUnderstandingInput,
  ): AssistantLlmUnderstandingOutput | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const normalizedMessage =
      this.cleanText(value.normalizedMessage, 500) ||
      this.cleanText(input.userMessage, 500);
    const queryType = this.normalizeQueryType(
      value.queryType,
      normalizedMessage,
    );
    const primaryIntent = this.normalizeIntent(
      value.primaryIntent,
      queryType,
      normalizedMessage,
    );
    const secondaryIntents = this.cleanIntentArray(value.secondaryIntents)
      .filter((intent) => intent !== primaryIntent)
      .slice(0, 4);
    const sentiment = this.normalizeSentiment(value.sentiment);
    const ambiguity = this.normalizeAmbiguity(value.ambiguity);
    const confidence = this.normalizeConfidence(value.confidence);
    const timeframe = this.cleanText(value.timeframe, 120);
    const clarificationQuestion = this.cleanText(
      value.clarificationQuestion,
      240,
    );
    const followUpContext = this.cleanText(value.followUpContext, 240);
    const entities = this.normalizeEntities(value.entities);

    return {
      normalizedMessage,
      primaryIntent,
      secondaryIntents,
      queryType,
      timeframe,
      clarificationNeeded: Boolean(value.clarificationNeeded),
      clarificationQuestion,
      followUpContext,
      language: this.normalizeLanguageLabel(value.language, input.userMessage),
      sentiment,
      frustration:
        Boolean(value.frustration) || sentiment === 'frustrated',
      ambiguity,
      confidence,
      entities,
    };
  }

  private normalizeEntities(value: unknown): AssistantLlmUnderstandingEntities {
    if (!this.isRecord(value)) {
      return {};
    }

    const entities: AssistantLlmUnderstandingEntities = {};

    if (this.hasText(value.eventType)) {
      entities.eventType = this.cleanText(value.eventType, 120);
    }

    if (this.hasText(value.occasion)) {
      entities.occasion = this.cleanText(value.occasion, 120);
    }

    if (this.hasText(value.serviceSlug)) {
      entities.serviceSlug = this.cleanText(value.serviceSlug, 80).toLowerCase();
    }

    const budgetAmount = this.normalizeNumber(value.budgetAmount);
    if (budgetAmount !== null) {
      entities.budgetAmount = budgetAmount;
    }

    if (this.hasText(value.budgetText)) {
      entities.budgetText = this.cleanText(value.budgetText, 80);
    }

    const guestCount = this.normalizeNumber(value.guestCount);
    if (guestCount !== null) {
      entities.guestCount = guestCount;
    }

    if (this.hasText(value.city)) {
      entities.city = this.cleanText(value.city, 120);
    }

    if (this.hasText(value.location)) {
      entities.location = this.cleanText(value.location, 120);
    }

    const venueType = this.cleanText(value.venueType, 40).toLowerCase();
    if (
      venueType === 'office' ||
      venueType === 'home' ||
      venueType === 'house' ||
      venueType === 'pool' ||
      venueType === 'hotel' ||
      venueType === 'banquet' ||
      venueType === 'banquet hall' ||
      venueType === 'resort' ||
      venueType === 'farmhouse' ||
      venueType === 'club' ||
      venueType === 'rooftop' ||
      venueType === 'outdoor venue'
    ) {
      entities.venueType = venueType;
    }

    const indoorOutdoor = this.cleanText(value.indoorOutdoor, 16).toLowerCase();
    if (indoorOutdoor === 'indoor' || indoorOutdoor === 'outdoor') {
      entities.indoorOutdoor = indoorOutdoor as 'indoor' | 'outdoor';
    }

    if (this.hasText(value.foodRequirement)) {
      entities.foodRequirement = this.cleanText(value.foodRequirement, 80);
    }

    const drinkRequirement = this.cleanText(value.drinkRequirement, 32).toLowerCase();
    if (drinkRequirement === 'dry' || drinkRequirement === 'alcoholic') {
      entities.drinkRequirement = drinkRequirement as 'dry' | 'alcoholic';
    }

    const bookingStatus = this.cleanText(value.bookingStatus, 40).toUpperCase();
    if (
      bookingStatus === 'CONFIRMED' ||
      bookingStatus === 'PROPOSAL_SENT' ||
      bookingStatus === 'NEW' ||
      bookingStatus === 'NEGOTIATING' ||
      bookingStatus === 'LOST'
    ) {
      entities.bookingStatus = bookingStatus;
    }

    const paymentStatus = this.cleanText(value.paymentStatus, 40).toUpperCase();
    if (
      paymentStatus === 'PENDING' ||
      paymentStatus === 'PAID' ||
      paymentStatus === 'FAILED' ||
      paymentStatus === 'REFUNDED' ||
      paymentStatus === 'UNPAID' ||
      paymentStatus === 'OVERDUE'
    ) {
      entities.paymentStatus = paymentStatus;
    }

    const contractStatus = this.cleanText(
      value.contractStatus,
      40,
    ).toUpperCase();
    if (
      contractStatus === 'DRAFT' ||
      contractStatus === 'SENT' ||
      contractStatus === 'SIGNED' ||
      contractStatus === 'ARCHIVED' ||
      contractStatus === 'CANCELLED'
    ) {
      entities.contractStatus = contractStatus;
    }

    const budgetPreference = this.cleanText(
      value.budgetPreference,
      16,
    ).toLowerCase();
    if (budgetPreference === 'lower' || budgetPreference === 'premium') {
      entities.budgetPreference = budgetPreference as 'lower' | 'premium';
    }

    if (typeof value.asksForEstimate === 'boolean') {
      entities.asksForEstimate = value.asksForEstimate;
    }

    if (typeof value.asksForComparison === 'boolean') {
      entities.asksForComparison = value.asksForComparison;
    }

    if (typeof value.asksForDraft === 'boolean') {
      entities.asksForDraft = value.asksForDraft;
    }

    return entities;
  }

  private normalizeIntent(
    value: unknown,
    queryType: AssistantLlmUnderstandingQueryType,
    normalizedMessage: string,
  ): AssistantIntent {
    const cleaned = this.cleanText(value, 80)
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z_]+/g, '');

    if (KNOWN_INTENTS.has(cleaned as AssistantIntent)) {
      return cleaned as AssistantIntent;
    }

    if (queryType === 'booking') {
      return 'booking_inquiry';
    }

    if (queryType === 'retrieval') {
      return 'search_request';
    }

    if (queryType === 'operational') {
      return 'operational_summary';
    }

    if (queryType === 'follow_up') {
      return 'booking_follow_up';
    }

    if (queryType === 'clarification') {
      return 'clarification_request';
    }

    if (queryType === 'support') {
      return 'support_escalation';
    }

    if (queryType === 'unsupported') {
      return 'unsupported_request';
    }

    if (detectGreetingSignal(normalizedMessage)) {
      return 'greeting';
    }

    if (detectIdentityQuestion(normalizedMessage)) {
      return 'informational_question';
    }

    if (detectCapabilityQuestion(normalizedMessage)) {
      return 'informational_question';
    }

    return 'informational_question';
  }

  private normalizeQueryType(
    value: unknown,
    normalizedMessage: string,
  ): AssistantLlmUnderstandingQueryType {
    const cleaned = this.cleanText(value, 32).toLowerCase();
    if (
      cleaned === 'booking' ||
      cleaned === 'retrieval' ||
      cleaned === 'operational' ||
      cleaned === 'follow_up' ||
      cleaned === 'clarification' ||
      cleaned === 'support' ||
      cleaned === 'unsupported' ||
      cleaned === 'general'
    ) {
      return cleaned;
    }

    if (
      includesAnyPhrase(normalizedMessage, [
        'summary',
        'overview',
        'attention',
        'blocked',
        'overdue',
        'pending tasks',
        'unread chats',
        'unsigned contracts',
      ])
    ) {
      return 'operational';
    }

    if (
      includesAnyPhrase(normalizedMessage, [
        'recent',
        'latest',
        'find',
        'search',
        'which booking',
        'which contract',
        'which payment',
      ])
    ) {
      return 'retrieval';
    }

    if (
      includesAnyPhrase(normalizedMessage, [
        'cheaper',
        'premium',
        'snacks',
        'indoor',
        'outdoor',
        'also',
        'add',
      ])
    ) {
      return 'follow_up';
    }

    if (detectUnsupportedRequest(normalizedMessage)) {
      return 'unsupported';
    }

    return 'general';
  }

  private normalizeSentiment(value: unknown): AssistantLlmUnderstandingSentiment {
    const sentiment = this.cleanText(value, 24).toLowerCase();
    if (
      sentiment === 'positive' ||
      sentiment === 'neutral' ||
      sentiment === 'negative' ||
      sentiment === 'frustrated'
    ) {
      return sentiment;
    }

    return 'neutral';
  }

  private normalizeAmbiguity(
    value: unknown,
  ): AssistantLlmUnderstandingAmbiguity {
    const ambiguity = this.cleanText(value, 16).toLowerCase();
    if (ambiguity === 'low' || ambiguity === 'medium' || ambiguity === 'high') {
      return ambiguity;
    }

    return 'low';
  }

  private normalizeConfidence(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.min(1, Number(value.toFixed(2))));
    }

    const parsed = Number.parseFloat(this.cleanText(value, 16));
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(1, Number(parsed.toFixed(2))));
    }

    return 0;
  }

  private cleanIntentArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [] as AssistantIntent[];
    }

    return value
      .map((item) =>
        this.cleanText(item, 80)
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z_]+/g, ''),
      )
      .filter((item): item is AssistantIntent =>
        KNOWN_INTENTS.has(item as AssistantIntent),
      )
      .filter((item, index, all) => all.indexOf(item) === index);
  }

  private cleanText(value: unknown, maxLength: number) {
    if (typeof value !== 'string') {
      return '';
    }

    return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  private hasText(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private normalizeNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    const parsed =
      typeof value === 'string'
        ? Number.parseFloat(value.replace(/,/g, '').trim())
        : Number.NaN;

    return Number.isFinite(parsed) ? parsed : null;
  }

  private guessLanguageLabel(message: string) {
    return detectSourceLanguage(message);
  }

  private normalizeLanguageLabel(value: unknown, fallbackMessage: string) {
    const cleaned = this.cleanText(value, 80);
    const canonical = this.canonicalizeLanguageLabel(cleaned);

    if (canonical) {
      return canonical;
    }

    return this.guessLanguageLabel(fallbackMessage);
  }

  private canonicalizeLanguageLabel(value: string) {
    const normalized = value.toLowerCase();

    if (!normalized) {
      return null;
    }

    if (normalized === 'english' || normalized === 'en') {
      return 'English';
    }

    if (normalized === 'hindi' || normalized === 'hin' || normalized === 'hi') {
      return 'Hindi';
    }

    if (normalized === 'hinglish' || normalized === 'mixed hindi english') {
      return 'Hinglish';
    }

    if (normalized === 'telugu' || normalized === 'te') {
      return 'Telugu';
    }

    if (normalized === 'tamil' || normalized === 'ta') {
      return 'Tamil';
    }

    if (normalized === 'bengali' || normalized === 'bangla' || normalized === 'bn') {
      return 'Bengali';
    }

    if (normalized === 'kannada' || normalized === 'kn') {
      return 'Kannada';
    }

    if (normalized === 'malayalam' || normalized === 'ml') {
      return 'Malayalam';
    }

    if (
      normalized === 'mixed' ||
      normalized === 'mixed language' ||
      normalized === 'multilingual'
    ) {
      return 'Mixed language';
    }

    return null;
  }

  private getString(metadata: Record<string, unknown>, key: string) {
    return typeof metadata[key] === 'string'
      ? this.cleanText(metadata[key], 120)
      : null;
  }

  private getNumber(metadata: Record<string, unknown>, key: string) {
    return typeof metadata[key] === 'number' && Number.isFinite(metadata[key])
      ? metadata[key]
      : null;
  }

  private getSerializableValue(metadata: Record<string, unknown>, key: string) {
    const value = metadata[key];

    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      Array.isArray(value) ||
      this.isRecord(value)
    ) {
      return value;
    }

    return null;
  }

  private getTrimmedEnv(key: string) {
    const value = this.configService.get<string>(key);
    const trimmed = typeof value === 'string' ? value.trim() : '';
    const unquoted =
      trimmed.length > 1 &&
      ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'")))
        ? trimmed.slice(1, -1).trim()
        : trimmed;

    return unquoted.length ? unquoted : null;
  }

  private getPositiveNumberEnv(key: string, fallback: number) {
    const value = this.configService.get<string | number | undefined>(key);
    const parsed =
      typeof value === 'number'
        ? value
        : Number.parseInt(String(value ?? ''), 10);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  private buildResponsesUrl() {
    const baseUrl = this.baseUrl.endsWith('/')
      ? this.baseUrl
      : `${this.baseUrl}/`;

    return new URL('responses', baseUrl).toString();
  }

  private async readResponseErrorMessage(response: Response) {
    const bodyText = await response.text();
    if (!bodyText.trim()) {
      return `http_${response.status}`;
    }

    try {
      const parsed = JSON.parse(bodyText) as {
        error?: { message?: string; type?: string; code?: string };
      };
      const error = parsed.error;
      const parts = [
        error?.type ? `type=${error.type}` : null,
        error?.code ? `code=${error.code}` : null,
        error?.message ? `message=${error.message}` : null,
      ].filter(Boolean);

      return parts.length ? parts.join(' ') : bodyText.slice(0, 160);
    } catch {
      return bodyText.slice(0, 160);
    }
  }

  private logStartupStatus() {
    this.logger.log(
      `OpenAI understanding startup: enabled=${this.isEnabled()} apiKeyPresent=${Boolean(this.apiKey)} model=${this.model} baseUrl=${this.baseUrl} timeoutMs=${this.timeoutMs} maxOutputTokens=${this.maxOutputTokens}`,
    );
  }

  private markLlMInvocation(
    diagnostics: AssistantLlmCallDiagnostics,
  ): AssistantLlmCallDiagnostics {
    diagnostics.called = true;
    diagnostics.source = 'llm';
    diagnostics.success = null;
    diagnostics.statusCode = null;
    diagnostics.fallbackReason = null;
    diagnostics.deterministicFallbackUsed = false;
    diagnostics.error = null;
    return diagnostics;
  }

  private markLlMSuccess(
    diagnostics: AssistantLlmCallDiagnostics,
    durationMs: number,
    _intent: AssistantIntent,
    _queryType: AssistantLlmUnderstandingQueryType,
    _language: string,
    _confidence: number,
  ) {
    diagnostics.durationMs = durationMs;
    diagnostics.success = true;
    diagnostics.source = 'llm';
    diagnostics.statusCode = 200;
    diagnostics.deterministicFallbackUsed = false;
    diagnostics.fallbackReason = null;
    diagnostics.error = null;
  }

  private markDeterministicFallback(
    diagnostics: AssistantLlmCallDiagnostics,
    reason: string,
    statusCode: number | null = null,
    error: string | null = null,
    durationMs: number | null = null,
  ) {
    diagnostics.source = 'deterministic';
    diagnostics.success = false;
    diagnostics.statusCode = statusCode;
    diagnostics.durationMs = durationMs;
    diagnostics.fallbackReason = reason;
    diagnostics.deterministicFallbackUsed = true;
    diagnostics.error = error;
  }
}
