import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  getResponseStyleConfig,
  isAssistantResponseStyle,
} from './assistant-response-style';
import {
  createAssistantLlmCallDiagnostics,
  type AssistantLlmCallDiagnostics,
} from './assistant-llm-diagnostics';
import type {
  AssistantLlmComposerInput,
  AssistantLlmComposerOutput,
  AssistantLlmCompositionTone,
} from './assistant-llm-composer.types';

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

const COMPOSITION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary',
    'details',
    'nextActions',
    'clarificationQuestion',
    'tone',
  ],
  properties: {
    summary: {
      type: 'string',
    },
    details: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    nextActions: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    clarificationQuestion: {
      type: 'string',
    },
    tone: {
      type: 'string',
      enum: ['calm', 'warm', 'direct', 'concise', 'supportive', 'professional'],
    },
  },
} as const;

@Injectable()
export class AssistantLlmComposerService {
  private readonly logger = new Logger(AssistantLlmComposerService.name);
  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxOutputTokens: number;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.getTrimmedEnv('OPENAI_API_KEY');
    this.model = this.getTrimmedEnv('OPENAI_MODEL') ?? 'gpt-5-mini';
    this.baseUrl = this.getTrimmedEnv('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1';
    this.timeoutMs = this.getPositiveNumberEnv(
      'OPENAI_RESPONSE_TIMEOUT_MS',
      4500,
    );
    this.maxOutputTokens = this.getPositiveNumberEnv(
      'OPENAI_MAX_OUTPUT_TOKENS',
      400,
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

  async compose(
    input: AssistantLlmComposerInput,
    diagnostics?: AssistantLlmCallDiagnostics | null,
  ): Promise<AssistantLlmComposerOutput | null> {
    const attemptDiagnostics =
      diagnostics ??
      createAssistantLlmCallDiagnostics({
        layer: 'composer',
        apiKeyPresent: Boolean(this.apiKey),
        model: this.model,
        baseUrl: this.baseUrl,
      });

    if (!this.apiKey) {
      this.markDeterministicFallback(attemptDiagnostics, 'missing_api_key');
      this.logger.log(
        `OpenAI composer skipped: called=false reason=missing_api_key source=deterministic model=${this.model} baseUrl=${this.baseUrl}`,
      );
      return null;
    }

    const startedAt = Date.now();
    this.markLlMInvocation(attemptDiagnostics);
    this.logger.log(
      `OpenAI composer invoked: called=true model=${this.model} baseUrl=${this.baseUrl} timeoutMs=${this.timeoutMs} maxOutputTokens=${this.maxOutputTokens}`,
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
          `OpenAI composer failed: called=true status=${response.status} durationMs=${durationMs} fallback=deterministic error=${errorMessage}`,
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
          `OpenAI composer failed: called=true durationMs=${durationMs} fallback=deterministic error=empty_output`,
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
          `OpenAI composer failed: called=true durationMs=${durationMs} fallback=deterministic error=invalid_json detail=${message}`,
        );
        return null;
      }

      const normalized = this.normalizeOutput(parsedOutput);
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
          `OpenAI composer failed: called=true durationMs=${durationMs} fallback=deterministic error=normalized_output_rejected`,
        );
        return null;
      }

      const durationMs = Date.now() - startedAt;
      this.markLlMSuccess(attemptDiagnostics, durationMs);
      this.logger.log(
        `OpenAI composer succeeded: called=true durationMs=${durationMs} source=llm tone=${normalized.tone} summaryLength=${normalized.summary.length} details=${normalized.details.length} nextActions=${normalized.nextActions.length}`,
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
      this.logger.warn(
        `OpenAI composer failed: called=true durationMs=${durationMs} fallback=deterministic error=${isAbort ? 'timeout' : message}`,
      );

      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildRequest(input: AssistantLlmComposerInput) {
    const payload = this.buildPromptPayload(input);

    return {
      model: this.model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: this.buildSystemPrompt(input),
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
          name: 'beer_assistant_response_composition',
          strict: true,
          schema: COMPOSITION_SCHEMA,
        },
      },
      max_output_tokens: this.maxOutputTokens,
      temperature: 0.2,
    };
  }

  private buildSystemPrompt(input: AssistantLlmComposerInput) {
    const style = isAssistantResponseStyle(input.responseStyle)
      ? input.responseStyle
      : 'direct_answer';
    const styleConfig = getResponseStyleConfig(style);
    const toneGuidance =
      input.role === 'CLIENT'
        ? 'Use a softer, reassuring, premium client tone.'
        : input.role === 'ADMIN'
          ? 'Use concise operational language and keep it sharp.'
          : input.role === 'VENDOR'
            ? 'Use calm, logistical, deadline-aware language.'
            : 'Use calm, helpful, premium SaaS language.';

    return [
      'You are Beer, a premium SaaS assistant copywriter.',
      'Rewrite deterministic assistant facts into natural assistant copy.',
      'Do not invent or change facts, counts, permissions, dates, statuses, amounts, or ownership.',
      'Use only the provided payload.',
      'If assistantUnderstanding is present, preserve its language, follow-up context, and frustration signals in the rewritten answer, but do not change the facts.',
      'If the understanding language is Hindi, Hinglish, Telugu, Tamil, Bengali, Kannada, Malayalam, or Mixed language, write the final answer in that same language style.',
      'Keep common business words like booking, payment, contract, chat, dashboard, unread, overdue, blocked, pending, task, project, and staff in English unless the user clearly used translated business terms.',
      'If something is missing, say it is missing or ask one focused clarification question.',
      'Keep the response grounded in the supplied draft reply and context signals.',
      `Current response style: ${style}.`,
      `Style rules: ${styleConfig.length} reply, ${styleConfig.tone} tone, ${styleConfig.format} formatting, and no more than ${styleConfig.maxActions} action labels.`,
      toneGuidance,
      'Return JSON only that matches the schema.',
    ].join(' ');
  }

  private buildPromptPayload(input: AssistantLlmComposerInput) {
    const responseStyle = isAssistantResponseStyle(input.responseStyle)
      ? input.responseStyle
      : 'direct_answer';
    const responseStyleConfig = getResponseStyleConfig(responseStyle);

    return {
      userMessage: input.userMessage,
      role: input.role,
      intent: input.intent,
      matchedIntents: input.matchedIntents,
      confidence: input.confidence,
      responseType: input.responseType,
      responseStyle,
      responseStyleConfig,
      page: {
        path: input.pagePath ?? null,
        title: input.pageTitle ?? null,
        key: input.pageKey,
        section: input.section,
      },
      contextSignals: this.pickContextSignals(input.contextMetadata),
      understanding: this.getSerializableValue(
        (input.responseMetadata ?? {}) as Record<string, unknown>,
        'assistantUnderstanding',
      ),
      memory: input.memory,
      entities: input.entities,
      missingDetails: this.pickMissingDetails(input),
      history: input.history.slice(-8),
      allowedActions: input.allowedActions,
      responseMetadata: input.responseMetadata,
      draftReply: input.deterministicReply.slice(0, 3000),
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

  private normalizeOutput(value: unknown) {
    if (!this.isRecord(value)) {
      return null;
    }

    const summary = this.cleanText(value.summary, 320);
    const details = this.cleanTextArray(value.details, 5);
    const nextActions = this.cleanTextArray(value.nextActions, 4);
    const clarificationQuestion = this.cleanText(
      value.clarificationQuestion,
      240,
    );
    const tone = this.cleanTone(value.tone);

    if (!summary && !clarificationQuestion) {
      return null;
    }

    return {
      summary: summary || clarificationQuestion,
      details,
      nextActions,
      clarificationQuestion,
      tone,
    } satisfies AssistantLlmComposerOutput;
  }

  private cleanText(value: unknown, maxLength: number) {
    if (typeof value !== 'string') {
      return '';
    }

    return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  private cleanTextArray(value: unknown, maxItems: number) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.cleanText(item, 180))
      .filter((item) => item.length > 0)
      .slice(0, maxItems);
  }

  private cleanTone(value: unknown): AssistantLlmCompositionTone {
    const tone = this.cleanText(value, 32).toLowerCase();

    if (
      tone === 'calm' ||
      tone === 'warm' ||
      tone === 'direct' ||
      tone === 'concise' ||
      tone === 'supportive' ||
      tone === 'professional'
    ) {
      return tone;
    }

    return 'professional';
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

  private pickMissingDetails(input: AssistantLlmComposerInput) {
    const responseType = input.responseType ?? '';
    const bookingLikeResponse =
      responseType === 'booking_consultation' ||
      responseType === 'booking_refinement' ||
      responseType === 'page_overview' ||
      responseType === 'dashboard_snapshot';

    if (!bookingLikeResponse) {
      return [];
    }

    const missing: string[] = [];

    if (
      !this.hasText(input.entities.eventType) &&
      !this.hasText(input.memory?.eventType)
    ) {
      missing.push('event type');
    }

    if (
      !this.hasText(input.entities.occasion) &&
      !this.hasText(input.memory?.occasion)
    ) {
      missing.push('occasion');
    }

    if (!this.hasText(input.entities.city) && !this.hasText(input.memory?.city)) {
      missing.push('city');
    }

    if (
      typeof input.entities.guestCount !== 'number' &&
      typeof input.memory?.guestCount !== 'number'
    ) {
      missing.push('guest count');
    }

    if (
      typeof input.entities.budgetAmount !== 'number' &&
      typeof input.memory?.budgetAmount !== 'number' &&
      !this.hasText(input.entities.budgetText) &&
      !this.hasText(input.memory?.budgetText)
    ) {
      missing.push('budget');
    }

    if (
      !this.hasText(input.entities.venueType) &&
      !this.hasText(input.memory?.venueType)
    ) {
      missing.push('venue preference');
    }

    if (
      !this.hasText(input.entities.indoorOutdoor) &&
      !this.hasText(input.memory?.indoorOutdoor)
    ) {
      missing.push('indoor or outdoor preference');
    }

    if (
      !this.hasText(input.entities.foodRequirement) &&
      !this.hasText(input.memory?.foodRequirement)
    ) {
      missing.push('food preference');
    }

    if (
      !this.hasText(input.entities.drinkRequirement) &&
      !this.hasText(input.memory?.drinkRequirement)
    ) {
      missing.push('drink preference');
    }

    return missing.slice(0, 6);
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

  private hasText(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0;
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
      `OpenAI composer startup: enabled=${this.isEnabled()} apiKeyPresent=${Boolean(this.apiKey)} model=${this.model} baseUrl=${this.baseUrl} timeoutMs=${this.timeoutMs} maxOutputTokens=${this.maxOutputTokens}`,
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
