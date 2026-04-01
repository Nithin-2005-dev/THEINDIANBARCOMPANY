/* eslint-disable @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { randomUUID } from 'crypto';
import {
  AiMessageActor,
  ContractStatus,
  PaymentStatus,
  Prisma,
  ProjectTaskStatus,
  Role,
} from '@prisma/client';
import {
  BadRequestException,
  Logger,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  createCopyAssistantAction,
  createDraftAssistantAction,
  createNavigateAssistantAction,
  dedupeAssistantActions,
} from './assistant-action-builder';
import {
  attachAssistantStateToContext,
  contextHasValues,
  deriveAssistantPageKey,
  deriveAssistantSection,
  normalizeAssistantContext,
} from './assistant-context-manager';
import { extractAssistantEntities } from './assistant-entity-extractor';
import type {
  AssistantClassification,
  AssistantConversationMemory,
  AssistantHistoryEntry,
  AssistantExtractedEntities,
  AssistantIntent,
} from './assistant-engine.types';
import { classifyAssistantInput } from './assistant-intent-classifier';
import {
  getAssistantHistoryFromMessages,
  mergeAssistantMemory,
  readAssistantMemory,
} from './assistant-memory-manager';
import { getDefaultPromptSuggestions } from './assistant.prompts';
import {
  buildBookingConversationContent,
  buildAssistantResponseContent,
  buildContextualFallbackCopy,
  buildStructuredReply,
} from './assistant-response-builder';
import {
  detectAssistantIdentityQuestion,
  detectCapabilityQuestion,
  detectCasualChatQuestion,
  detectFollowUpSignal,
  detectIdentityQuestion,
  detectOffTopicRequest,
  detectPersonalQuestion,
  detectRepairSignal,
  detectServiceRecommendationQuestion,
  detectUnsupportedRequest,
  detectUnsupportedPersonalDataQuestion,
  detectUserIdentityQuestion,
  detectSourceLanguage,
} from './assistant-language';
import {
  classifyAssistantResponseStyle,
  getResponseStyleConfig,
  isAssistantResponseStyle,
  type AssistantResponseStyle,
} from './assistant-response-style';
import { AssistantLlmComposerService } from './assistant-llm-composer.service';
import { AssistantLlmUnderstandingService } from './assistant-llm-understanding.service';
import {
  createAssistantLlmCallDiagnostics,
  type AssistantLlmCallDiagnostics,
} from './assistant-llm-diagnostics';
import {
  AssistantOperationalService,
  type AssistantOperationalBucket,
  type AssistantOperationalRecord,
  type AssistantOperationalSummary,
} from './assistant-operational.service';
import type { AssistantLlmUnderstandingOutput } from './assistant-understanding.types';
import type {
  AssistantAction,
  AssistantContextInput,
  AssistantLiveTurnResponse,
  AssistantPromptSuggestion,
  AssistantSerializedConversation,
  AssistantSerializedMessage,
} from './assistant.types';
import { CreateAssistantConversationDto } from './dto/create-assistant-conversation.dto';
import { AssistantSuggestionsQueryDto } from './dto/assistant-suggestions-query.dto';
import { RenameAssistantConversationDto } from './dto/rename-assistant-conversation.dto';
import { SendAssistantMessageDto } from './dto/send-assistant-message.dto';

const assistantUserSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  role: true,
  isActive: true,
} satisfies Prisma.UserSelect;

const leadActivityInclude = {
  orderBy: { createdAt: 'desc' as const },
  take: 6,
  include: {
    actor: {
      select: {
        id: true,
        name: true,
        role: true,
      },
    },
  },
};

const activeAssignmentsInclude = {
  where: { isActive: true },
  orderBy: { startedAt: 'asc' as const },
  include: {
    user: {
      select: assistantUserSelect,
    },
  },
};

const projectCoreInclude = {
  payments: {
    where: { deletedAt: null },
    orderBy: [{ dueDate: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  assignments: activeAssignmentsInclude,
  vendors: {
    include: {
      vendor: true,
    },
  },
  tasks: {
    where: { deletedAt: null },
    orderBy: [{ status: 'asc' as const }, { dueDate: 'asc' as const }],
    include: {
      assignedUser: {
        select: assistantUserSelect,
      },
      assignedVendor: true,
    },
  },
  updates: {
    orderBy: { createdAt: 'desc' as const },
    take: 6,
    include: {
      createdBy: {
        select: assistantUserSelect,
      },
    },
  },
  documents: {
    orderBy: { createdAt: 'desc' as const },
    take: 8,
  },
} satisfies Prisma.ProjectInclude;

const leadSummaryInclude = {
  client: {
    select: assistantUserSelect,
  },
  assignments: activeAssignmentsInclude,
  activities: leadActivityInclude,
} satisfies Prisma.LeadInclude;

const assistantLeadInclude = {
  ...leadSummaryInclude,
  proposals: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: {
      contract: {
        include: {
          versions: {
            orderBy: { createdAt: 'desc' as const },
            take: 8,
          },
          project: {
            include: projectCoreInclude,
          },
        },
      },
    },
  },
} satisfies Prisma.LeadInclude;

const assistantProjectInclude = {
  ...projectCoreInclude,
  client: {
    select: assistantUserSelect,
  },
  contract: {
    include: {
      versions: {
        orderBy: { createdAt: 'desc' as const },
        take: 8,
      },
      proposal: {
        include: {
          lead: {
            include: leadSummaryInclude,
          },
        },
      },
    },
  },
} satisfies Prisma.ProjectInclude;

const assistantConversationInclude = {
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
  contexts: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
  _count: {
    select: {
      messages: true,
    },
  },
} satisfies Prisma.AiConversationInclude;

const OPERATIONAL_INTENTS = new Set<AssistantIntent>([
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
]);

type AssistantTurn = {
  content: string;
  actions: AssistantAction[];
  metadata?: Record<string, unknown>;
};

type AssistantTurnState = {
  history: AssistantHistoryEntry[];
  classification: AssistantClassification;
  memory: AssistantConversationMemory | null;
  entities: AssistantExtractedEntities;
  understanding: AssistantLlmUnderstandingOutput | null;
  diagnostics: AssistantPipelineDiagnostics;
};

type AssistantPipelineDiagnostics = {
  understanding: AssistantLlmCallDiagnostics;
  composer: AssistantLlmCallDiagnostics;
};

type AssistantPipelineDebugTrace = {
  rawUserMessage: string;
  detectedLanguage: string | null;
  normalizedMessage: string;
  llm: AssistantPipelineDiagnostics;
  understanding: {
    intent: string;
    secondaryIntents: string[];
    queryType: string | null;
    timeframe: string | null;
    retrievalTarget: string | null;
    bookingVsRetrieval: string | null;
    confidence: number | null;
    ambiguity: string | null;
    frustration: boolean | null;
    explanation: string | null;
    entities: Record<string, unknown>;
  };
  deterministicIntentOverride: {
    original: string;
    overridden: string;
    reason: string;
  };
  entityExtraction: Record<string, unknown>;
  retrieval: {
    searchText: string | null;
    semanticQuery: string | null;
    appliedFilters: Record<string, unknown> | null;
    selectedScope: string | null;
    memoryReferences: Record<string, unknown> | null;
    results: Array<{
      entityId: string;
      name: string;
      city: string | null;
      score: number;
      whyMatched: string;
    }>;
  } | null;
  final: {
    responseStyle: string | null;
    actionChips: string[];
    llmComposerUsed: boolean;
    finalReplyPayload: Record<string, unknown>;
  } | null;
};

type AssistantBookingInsight = {
  occasion?: string;
  eventType?: string;
  serviceSlug?: string | null;
  guestCount?: number;
  budgetAmount?: number;
  budgetText?: string;
  budgetPreference?: 'lower' | 'premium';
  city?: string;
  location?: string;
  venueType?: string;
  indoorOutdoor?: 'indoor' | 'outdoor';
  foodRequirement?: string;
  drinkRequirement?: 'dry' | 'alcoholic';
  likelyInclusions: string[];
  missingDetails: string[];
  meaningfulTurns?: number;
};

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmComposer: AssistantLlmComposerService,
    private readonly llmUnderstanding: AssistantLlmUnderstandingService,
    private readonly operationalService: AssistantOperationalService,
  ) {}

  async listConversations(
    user: AuthUser,
    search?: string,
    archived = false,
  ): Promise<AssistantSerializedConversation[]> {
    const conversations = await this.prisma.aiConversation.findMany({
      where: {
        userId: user.userId,
        deletedAt: null,
        isArchived: archived,
        ...(search?.trim()
          ? {
              OR: [
                {
                  title: {
                    contains: search.trim(),
                    mode: 'insensitive',
                  },
                },
                {
                  messages: {
                    some: {
                      content: {
                        contains: search.trim(),
                        mode: 'insensitive',
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: assistantConversationInclude,
      orderBy: [
        { isPinned: 'desc' },
        { pinnedAt: 'desc' },
        { lastMessageAt: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: 60,
    });

    return conversations.map((conversation) =>
      this.serializeConversation(conversation),
    );
  }

  async createConversation(
    user: AuthUser,
    dto: CreateAssistantConversationDto,
  ): Promise<AssistantSerializedConversation> {
    const title = dto.title?.trim() || 'New Concierge Thread';

    const conversation = await this.prisma.aiConversation.create({
      data: {
        userId: user.userId,
        title,
        contexts: dto.context
          ? {
              create: this.buildContextCreateInput(user.role, dto.context),
            }
          : undefined,
      },
      include: assistantConversationInclude,
    });

    return this.serializeConversation(conversation);
  }

  async getMessages(
    user: AuthUser,
    conversationId: string,
  ): Promise<AssistantSerializedMessage[]> {
    await this.ensureConversation(user.userId, conversationId);

    const messages = await this.prisma.aiMessage.findMany({
      where: {
        conversationId,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return messages.map((message) => this.serializeMessage(message));
  }

  async updateConversation(
    user: AuthUser,
    conversationId: string,
    dto: RenameAssistantConversationDto,
  ): Promise<AssistantSerializedConversation> {
    await this.ensureConversation(user.userId, conversationId);

    const data: Prisma.AiConversationUpdateInput = {};

    if (typeof dto.title === 'string' && dto.title.trim()) {
      data.title = dto.title.trim();
    }

    if (typeof dto.isArchived === 'boolean') {
      data.isArchived = dto.isArchived;
      data.archivedAt = dto.isArchived ? new Date() : null;

      if (dto.isArchived) {
        data.isPinned = false;
        data.pinnedAt = null;
      }
    }

    if (typeof dto.isPinned === 'boolean') {
      data.isPinned = dto.isPinned;
      data.pinnedAt = dto.isPinned ? new Date() : null;
    }

    if (!Object.keys(data).length) {
      throw new BadRequestException('No conversation update was provided.');
    }

    const conversation = await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data,
      include: assistantConversationInclude,
    });

    return this.serializeConversation(conversation);
  }

  async deleteConversation(user: AuthUser, conversationId: string) {
    await this.ensureConversation(user.userId, conversationId);

    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        deletedAt: new Date(),
      },
    });

    return { success: true };
  }

  async trackEvent(
    user: AuthUser,
    input: {
      eventType: string;
      conversationId?: string;
      messageId?: string;
      pageKey?: string;
      section?: string;
      intent?: string;
      label?: string;
      contentSnippet?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    await this.logAssistantEvent(user, input);
    return { success: true };
  }

  async getSuggestions(
    user: AuthUser,
    query: AssistantSuggestionsQueryDto,
  ): Promise<AssistantPromptSuggestion[]> {
    const context = normalizeAssistantContext(query);
    const pageKey = deriveAssistantPageKey(
      user.role,
      context.pagePath,
      context,
    );

    const customSuggestions = await this.prisma.aiPromptSuggestion.findMany({
      where: {
        isActive: true,
        OR: [
          { role: user.role, pageKey },
          { role: user.role, pageKey: null },
          { role: null, pageKey },
          { role: null, pageKey: null },
        ],
      },
      orderBy: [{ rank: 'desc' }, { updatedAt: 'desc' }],
      take: 8,
    });
    const defaultSuggestions = getDefaultPromptSuggestions(user.role, pageKey);
    const combinedSuggestions = this.dedupePromptSuggestions([
      ...customSuggestions.map((suggestion) => ({
        id: suggestion.id,
        title: suggestion.title,
        prompt: suggestion.prompt,
        description: suggestion.description ?? undefined,
        role: suggestion.role,
        pageKey: suggestion.pageKey,
        rank: suggestion.rank,
      })),
      ...defaultSuggestions.map((suggestion) => ({
        ...suggestion,
        role: user.role,
        pageKey,
        rank: 0,
      })),
    ]);

    const telemetryWindowStart = new Date();
    telemetryWindowStart.setDate(telemetryWindowStart.getDate() - 30);
    const telemetryEvents = await this.prisma.aiAssistantEvent.findMany({
      where: {
        createdAt: {
          gte: telemetryWindowStart,
        },
        role: user.role,
        ...(pageKey ? { pageKey } : {}),
        eventType: {
          in: [
            'assistant_opened',
            'message_received',
            'assistant_fallback',
            'action_clicked',
            'conversation_search',
          ],
        },
      },
      select: {
        eventType: true,
        intent: true,
        label: true,
        contentSnippet: true,
        pageKey: true,
        metadata: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 120,
    });

    const telemetryWeights = new Map<string, number>();
    const addTelemetryTerms = (
      text: string | null | undefined,
      weight: number,
    ) => {
      const normalized = text?.trim().toLowerCase() ?? '';
      if (!normalized) {
        return;
      }

      for (const term of this.extractAssistantTelemetryTerms(normalized)) {
        telemetryWeights.set(term, (telemetryWeights.get(term) ?? 0) + weight);
      }
    };

    for (const event of telemetryEvents) {
      if (event.eventType === 'action_clicked') {
        addTelemetryTerms(event.label, 6);
        const metadata =
          event.metadata &&
          typeof event.metadata === 'object' &&
          !Array.isArray(event.metadata)
            ? (event.metadata as Record<string, unknown>)
            : null;
        if (typeof metadata?.actionType === 'string') {
          addTelemetryTerms(metadata.actionType, 4);
        }
        continue;
      }

      if (event.eventType === 'assistant_fallback') {
        addTelemetryTerms(event.contentSnippet, 5);
        addTelemetryTerms(event.intent, 3);
        continue;
      }

      if (event.eventType === 'conversation_search') {
        addTelemetryTerms(event.contentSnippet, 5);
        continue;
      }

      if (event.eventType === 'assistant_opened') {
        addTelemetryTerms(event.label ?? event.pageKey, 2);
        continue;
      }

      addTelemetryTerms(event.contentSnippet, 3);
      addTelemetryTerms(event.intent, 2);
    }

    const adaptiveSuggestions = this.buildAdaptivePromptSuggestions(
      user,
      pageKey,
      context,
      telemetryEvents,
      telemetryWeights,
    );
    const candidateSuggestions = this.dedupePromptSuggestions([
      ...combinedSuggestions,
      ...adaptiveSuggestions.map((suggestion) => ({
        ...suggestion,
        role: user.role,
        pageKey,
        rank: 0,
      })),
    ]);

    return candidateSuggestions
      .map((suggestion, index) => {
        const text =
          `${suggestion.title} ${suggestion.prompt} ${suggestion.description ?? ''}`
            .toLowerCase()
            .trim();
        let score = suggestion.rank ?? 0;

        if (suggestion.pageKey && suggestion.pageKey === pageKey) {
          score += 8;
        }

        if (suggestion.role === user.role) {
          score += 3;
        }

        for (const [term, weight] of telemetryWeights.entries()) {
          if (!term || !text.includes(term)) {
            continue;
          }

          score += weight;
        }

        if (telemetryEvents.some((event) => event.label === suggestion.title)) {
          score += 5;
        }

        if (
          telemetryEvents.some(
            (event) =>
              event.contentSnippet?.trim().toLowerCase() ===
              suggestion.prompt.trim().toLowerCase(),
          )
        ) {
          score += 6;
        }

        return {
          suggestion,
          score,
          index,
        };
      })
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if ((right.suggestion.rank ?? 0) !== (left.suggestion.rank ?? 0)) {
          return (right.suggestion.rank ?? 0) - (left.suggestion.rank ?? 0);
        }

        return left.index - right.index;
      })
      .slice(0, 8)
      .map(({ suggestion }) => ({
        id: suggestion.id,
        title: suggestion.title,
        prompt: suggestion.prompt,
        description: suggestion.description ?? undefined,
      }));
  }

  async sendMessage(
    user: AuthUser,
    conversationId: string,
    dto: SendAssistantMessageDto,
  ) {
    const conversation = await this.ensureConversation(
      user.userId,
      conversationId,
    );
    const latestContextRecord =
      await this.prisma.aiConversationContext.findFirst({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
      });
    const previousContext = latestContextRecord
      ? this.contextRecordToInput(latestContextRecord)
      : undefined;
    const previousMetadata = latestContextRecord
      ? this.toObjectRecord(latestContextRecord.metadata)
      : null;
    const previousMemory = readAssistantMemory(previousMetadata);
    const normalizedContext = normalizeAssistantContext(
      dto.context,
      previousContext,
    );
    const messageContent = dto.content.trim();

    if (!messageContent) {
      throw new BadRequestException('Message content is required.');
    }

    const recentMessages = await this.prisma.aiMessage.findMany({
      where: {
        conversationId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10,
    });
    const history = getAssistantHistoryFromMessages(
      [...recentMessages].reverse(),
    );
    const assistantTurnState = await this.prepareAssistantTurnState({
      user,
      message: messageContent,
      context: normalizedContext,
      history,
      previousMemory,
    });
    const debugTrace = this.isDebugTracingEnabled()
      ? this.createAssistantPipelineDebugTrace({
          user,
          message: messageContent,
          context: normalizedContext,
          state: assistantTurnState.turnState,
        })
      : null;

    const userMessage = await this.prisma.aiMessage.create({
      data: {
        conversationId,
        actor: AiMessageActor.USER,
        role: user.role,
        content: messageContent,
        metadata: {
          classification: assistantTurnState.classification,
          entities: assistantTurnState.entities,
          context: assistantTurnState.requestContext,
        } as Prisma.InputJsonValue,
      },
    });
    await this.logAssistantEvent(user, {
      eventType: 'message_received',
      conversationId,
      messageId: userMessage.id,
      pageKey: assistantTurnState.pageKey,
      section: assistantTurnState.section,
      intent: assistantTurnState.classification.primaryIntent,
      contentSnippet: messageContent.slice(0, 240),
      metadata: {
        matchedIntents: assistantTurnState.classification.matchedIntents,
        entities: assistantTurnState.entities,
        llmUnderstandingUsed: Boolean(assistantTurnState.understanding),
        llmUnderstandingLanguage:
          assistantTurnState.understanding?.language ?? null,
        llmUnderstandingQueryType:
          assistantTurnState.understanding?.queryType ?? null,
      },
    });

    let turn: AssistantTurn;

    try {
      turn = await this.generateAssistantTurn(
        user,
        assistantTurnState.analysisMessage,
        assistantTurnState.requestContext,
        assistantTurnState.turnState,
        debugTrace,
      );
    } catch {
      turn = {
        content:
          "I hit a snag while pulling the latest workspace context. Give me one more try and I'll re-run the check.",
        actions: [
          {
            id: 'refresh-thread',
            type: 'REFRESH',
            label: 'Refresh and retry',
            description: 'Pull the latest assistant state and try again.',
          },
        ],
        metadata: {
          responseType: 'fallback',
        },
      };
    }

    turn = this.attachUnderstandingToTurn(
      turn,
      assistantTurnState.understanding,
      assistantTurnState.turnState.diagnostics,
    );
    turn = this.annotateAssistantTurnStyle({
      user,
      message: assistantTurnState.analysisMessage,
      context: assistantTurnState.requestContext,
      history,
      classification: assistantTurnState.classification,
      memory: assistantTurnState.activeMemory,
      entities: assistantTurnState.entities,
      pageKey: assistantTurnState.pageKey,
      section: assistantTurnState.section,
      turn,
    });

    turn = await this.maybeComposeAssistantTurn({
      user,
      message: assistantTurnState.analysisMessage,
      context: assistantTurnState.requestContext,
      history,
      classification: assistantTurnState.classification,
      memory: assistantTurnState.activeMemory,
      entities: assistantTurnState.entities,
      pageKey: assistantTurnState.pageKey,
      section: assistantTurnState.section,
      turn,
      diagnostics: assistantTurnState.turnState.diagnostics,
    });

    if (debugTrace) {
      this.finalizeAssistantPipelineDebugTrace(debugTrace, turn);
      this.logAssistantPipelineDebugTrace(debugTrace);
    }

    const responseType =
      typeof turn.metadata?.responseType === 'string'
        ? turn.metadata.responseType
        : null;
    const unresolvedResponse =
      responseType === 'fallback' || responseType === 'clarification';
    const finalMemory = {
      ...assistantTurnState.activeMemory,
      serviceRecommendation:
        (typeof turn.metadata?.serviceRecommendation === 'string'
          ? turn.metadata.serviceRecommendation
          : null) ??
        assistantTurnState.activeMemory.serviceRecommendation ??
        null,
      bookingStatus:
        (typeof turn.metadata?.bookingStatus === 'string'
          ? turn.metadata.bookingStatus
          : null) ?? assistantTurnState.activeMemory.bookingStatus,
      paymentStatus:
        (typeof turn.metadata?.paymentStatus === 'string'
          ? turn.metadata.paymentStatus
          : null) ?? assistantTurnState.activeMemory.paymentStatus,
      contractStatus:
        (typeof turn.metadata?.contractStatus === 'string'
          ? turn.metadata.contractStatus
          : null) ?? assistantTurnState.activeMemory.contractStatus,
      lastSearchQuery:
        (typeof turn.metadata?.searchQuery === 'string'
          ? turn.metadata.searchQuery
          : null) ?? assistantTurnState.activeMemory.lastSearchQuery,
      fallbackCount:
        (assistantTurnState.activeMemory.fallbackCount ?? 0) +
        (unresolvedResponse ? 1 : 0),
      lastFallbackAt: unresolvedResponse
        ? new Date().toISOString()
        : assistantTurnState.activeMemory.lastFallbackAt,
      lastFallbackIntent: unresolvedResponse
        ? assistantTurnState.classification.primaryIntent
        : assistantTurnState.activeMemory.lastFallbackIntent,
      lastUpdatedAt: new Date().toISOString(),
    } satisfies AssistantConversationMemory;
    const persistedContext = attachAssistantStateToContext({
      context: normalizedContext,
      history: [
        ...history,
        { actor: 'USER', content: messageContent },
        { actor: 'ASSISTANT', content: turn.content },
      ],
      memory: finalMemory,
      classification: assistantTurnState.classification,
      entities: assistantTurnState.entities,
      understanding: assistantTurnState.understanding,
    });

    const assistantMessage = await this.prisma.aiMessage.create({
      data: {
        conversationId,
        actor: AiMessageActor.ASSISTANT,
        role: user.role,
        content: turn.content,
        metadata: {
          ...turn.metadata,
          actions: turn.actions,
          classification: assistantTurnState.classification,
          entities: assistantTurnState.entities,
          context: persistedContext,
        } as Prisma.InputJsonValue,
      },
    });
    await this.logAssistantEvent(user, {
      eventType: 'response_sent',
      conversationId,
      messageId: assistantMessage.id,
      pageKey: assistantTurnState.pageKey,
      section: assistantTurnState.section,
      intent: assistantTurnState.classification.primaryIntent,
      label:
        typeof turn.metadata?.responseType === 'string'
          ? turn.metadata.responseType
          : undefined,
      contentSnippet: turn.content.slice(0, 240),
      metadata: {
        matchedIntents: assistantTurnState.classification.matchedIntents,
        actionCount: turn.actions.length,
        fallback:
          typeof turn.metadata?.responseType === 'string' &&
          turn.metadata.responseType === 'fallback',
        unsupported:
          typeof turn.metadata?.responseType === 'string' &&
          turn.metadata.responseType === 'unsupported_request',
        llmComposed:
          typeof turn.metadata?.llmComposed === 'boolean'
            ? turn.metadata.llmComposed
            : false,
        llmTone:
          typeof turn.metadata?.llmTone === 'string'
            ? turn.metadata.llmTone
            : null,
        llmUnderstandingUsed:
          typeof turn.metadata?.llmUnderstandingUsed === 'boolean'
            ? turn.metadata.llmUnderstandingUsed
            : false,
      },
    });

    if (responseType === 'fallback') {
      await this.logAssistantEvent(user, {
        eventType: 'assistant_fallback',
        conversationId,
        messageId: assistantMessage.id,
        pageKey: assistantTurnState.pageKey,
        section: assistantTurnState.section,
        intent: assistantTurnState.classification.primaryIntent,
        contentSnippet: messageContent.slice(0, 240),
        metadata: {
          matchedIntents: assistantTurnState.classification.matchedIntents,
          fallbackReply: turn.content.slice(0, 240),
        },
      });
    }

    if (responseType === 'clarification') {
      await this.logAssistantEvent(user, {
        eventType: 'assistant_clarification',
        conversationId,
        messageId: assistantMessage.id,
        pageKey: assistantTurnState.pageKey,
        section: assistantTurnState.section,
        intent: assistantTurnState.classification.primaryIntent,
        contentSnippet: messageContent.slice(0, 240),
        metadata: {
          matchedIntents: assistantTurnState.classification.matchedIntents,
          clarificationKind:
            typeof turn.metadata?.clarificationKind === 'string'
              ? turn.metadata.clarificationKind
              : null,
          clarificationQuestion: turn.content.slice(0, 240),
        },
      });
    }

    if (responseType === 'unsupported_request') {
      await this.logAssistantEvent(user, {
        eventType: 'assistant_unsupported_request',
        conversationId,
        messageId: assistantMessage.id,
        pageKey: assistantTurnState.pageKey,
        section: assistantTurnState.section,
        intent: assistantTurnState.classification.primaryIntent,
        contentSnippet: messageContent.slice(0, 240),
        metadata: {
          matchedIntents: assistantTurnState.classification.matchedIntents,
          unsupportedReason:
            typeof turn.metadata?.unsupportedReason === 'string'
              ? turn.metadata.unsupportedReason
              : null,
          suggestedService:
            typeof turn.metadata?.serviceRecommendation === 'string'
              ? turn.metadata.serviceRecommendation
              : null,
        },
      });
    }

    if (contextHasValues(persistedContext)) {
      await this.prisma.aiConversationContext.create({
        data: {
          conversationId,
          ...this.buildContextCreateInput(user.role, persistedContext),
        },
      });
    }

    const shouldRetitle =
      conversation.title === 'New Concierge Thread' ||
      conversation.title === 'Beer the Bear';

    const refreshedConversation = await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        title: shouldRetitle
          ? this.generateConversationTitle(messageContent)
          : conversation.title,
        lastMessageAt: assistantMessage.createdAt,
      },
      include: assistantConversationInclude,
    });

    return {
      conversation: this.serializeConversation(refreshedConversation),
      userMessage: this.serializeMessage(userMessage),
      assistantMessage: this.serializeMessage(assistantMessage),
    };
  }

  async sendLiveMessage(
    user: AuthUser,
    dto: SendAssistantMessageDto,
  ): Promise<AssistantLiveTurnResponse> {
    const normalizedContext = normalizeAssistantContext(dto.context);
    const messageContent = dto.content.trim();

    if (!messageContent) {
      throw new BadRequestException('Message content is required.');
    }

    const previousMemory = readAssistantMemory(
      this.toObjectRecord(normalizedContext.metadata as Prisma.JsonValue),
    );
    const history = this.getConversationHistory(normalizedContext);
    const assistantTurnState = await this.prepareAssistantTurnState({
      user,
      message: messageContent,
      context: normalizedContext,
      history,
      previousMemory,
    });
    const debugTrace = this.isDebugTracingEnabled()
      ? this.createAssistantPipelineDebugTrace({
          user,
          message: messageContent,
          context: normalizedContext,
          state: assistantTurnState.turnState,
        })
      : null;

    const now = new Date();
    const userMessage = this.createTransientMessage({
      id: randomUUID(),
      actor: AiMessageActor.USER,
      role: user.role,
      content: messageContent,
      createdAt: now,
      metadata: {
        classification: assistantTurnState.classification,
        entities: assistantTurnState.entities,
        context: assistantTurnState.requestContext,
      },
    });

    let turn: AssistantTurn;

    try {
      turn = await this.generateAssistantTurn(
        user,
        assistantTurnState.analysisMessage,
        assistantTurnState.requestContext,
        assistantTurnState.turnState,
        debugTrace,
      );
    } catch {
      turn = {
        content:
          "I hit a snag while pulling the latest workspace context. Give me one more try and I'll re-run the check.",
        actions: [
          {
            id: 'refresh-thread',
            type: 'REFRESH',
            label: 'Refresh and retry',
            description: 'Pull the latest assistant state and try again.',
          },
        ],
        metadata: {
          responseType: 'fallback',
        },
      };
    }

    turn = this.attachUnderstandingToTurn(
      turn,
      assistantTurnState.understanding,
      assistantTurnState.turnState.diagnostics,
    );
    turn = this.annotateAssistantTurnStyle({
      user,
      message: assistantTurnState.analysisMessage,
      context: assistantTurnState.requestContext,
      history,
      classification: assistantTurnState.classification,
      memory: assistantTurnState.activeMemory,
      entities: assistantTurnState.entities,
      pageKey: assistantTurnState.pageKey,
      section: assistantTurnState.section,
      turn,
    });

    turn = await this.maybeComposeAssistantTurn({
      user,
      message: assistantTurnState.analysisMessage,
      context: assistantTurnState.requestContext,
      history,
      classification: assistantTurnState.classification,
      memory: assistantTurnState.activeMemory,
      entities: assistantTurnState.entities,
      pageKey: assistantTurnState.pageKey,
      section: assistantTurnState.section,
      turn,
      diagnostics: assistantTurnState.turnState.diagnostics,
    });

    if (debugTrace) {
      this.finalizeAssistantPipelineDebugTrace(debugTrace, turn);
      this.logAssistantPipelineDebugTrace(debugTrace);
    }

    const finalMemory = {
      ...assistantTurnState.activeMemory,
      serviceRecommendation:
        (typeof turn.metadata?.serviceRecommendation === 'string'
          ? turn.metadata.serviceRecommendation
          : null) ??
        assistantTurnState.activeMemory.serviceRecommendation ??
        null,
      bookingStatus:
        (typeof turn.metadata?.bookingStatus === 'string'
          ? turn.metadata.bookingStatus
          : null) ?? assistantTurnState.activeMemory.bookingStatus,
      paymentStatus:
        (typeof turn.metadata?.paymentStatus === 'string'
          ? turn.metadata.paymentStatus
          : null) ?? assistantTurnState.activeMemory.paymentStatus,
      contractStatus:
        (typeof turn.metadata?.contractStatus === 'string'
          ? turn.metadata.contractStatus
          : null) ?? assistantTurnState.activeMemory.contractStatus,
      lastSearchQuery:
        (typeof turn.metadata?.searchQuery === 'string'
          ? turn.metadata.searchQuery
          : null) ?? assistantTurnState.activeMemory.lastSearchQuery,
      fallbackCount:
        (assistantTurnState.activeMemory.fallbackCount ?? 0) +
        (typeof turn.metadata?.responseType === 'string' &&
        turn.metadata.responseType === 'fallback'
          ? 1
          : 0),
      lastFallbackAt:
        typeof turn.metadata?.responseType === 'string' &&
        turn.metadata.responseType === 'fallback'
          ? new Date().toISOString()
          : assistantTurnState.activeMemory.lastFallbackAt,
      lastFallbackIntent:
        typeof turn.metadata?.responseType === 'string' &&
        turn.metadata.responseType === 'fallback'
          ? assistantTurnState.classification.primaryIntent
          : assistantTurnState.activeMemory.lastFallbackIntent,
      lastUpdatedAt: new Date().toISOString(),
    } satisfies AssistantConversationMemory;
    const persistedContext = attachAssistantStateToContext({
      context: normalizedContext,
      history: [
        ...history,
        { actor: 'USER', content: messageContent },
        { actor: 'ASSISTANT', content: turn.content },
      ],
      memory: finalMemory,
      classification: assistantTurnState.classification,
      entities: assistantTurnState.entities,
      understanding: assistantTurnState.understanding,
    });

    const assistantMessage = this.createTransientMessage({
      id: randomUUID(),
      actor: AiMessageActor.ASSISTANT,
      role: user.role,
      content: turn.content,
      createdAt: new Date(now.getTime() + 1),
      actions: turn.actions,
      metadata: {
        ...turn.metadata,
        actions: turn.actions,
        classification: assistantTurnState.classification,
        entities: assistantTurnState.entities,
        context: persistedContext,
      },
    });
    await this.logAssistantEvent(user, {
      eventType: 'live_response_sent',
      pageKey: assistantTurnState.pageKey,
      section: assistantTurnState.section,
      intent: assistantTurnState.classification.primaryIntent,
      label:
        typeof turn.metadata?.responseType === 'string'
          ? turn.metadata.responseType
          : undefined,
      contentSnippet: turn.content.slice(0, 240),
      metadata: {
        matchedIntents: assistantTurnState.classification.matchedIntents,
        actionCount: turn.actions.length,
        unsupported:
          typeof turn.metadata?.responseType === 'string' &&
          turn.metadata.responseType === 'unsupported_request',
        llmComposed:
          typeof turn.metadata?.llmComposed === 'boolean'
            ? turn.metadata.llmComposed
            : false,
        llmTone:
          typeof turn.metadata?.llmTone === 'string'
            ? turn.metadata.llmTone
            : null,
        llmUnderstandingUsed:
          typeof turn.metadata?.llmUnderstandingUsed === 'boolean'
            ? turn.metadata.llmUnderstandingUsed
            : false,
      },
    });

    if (
      typeof turn.metadata?.responseType === 'string' &&
      turn.metadata.responseType === 'fallback'
    ) {
      await this.logAssistantEvent(user, {
        eventType: 'assistant_fallback',
        pageKey: assistantTurnState.pageKey,
        section: assistantTurnState.section,
        intent: assistantTurnState.classification.primaryIntent,
        contentSnippet: messageContent.slice(0, 240),
        metadata: {
          matchedIntents: assistantTurnState.classification.matchedIntents,
          fallbackReply: turn.content.slice(0, 240),
        },
      });
    }

    if (
      typeof turn.metadata?.responseType === 'string' &&
      turn.metadata.responseType === 'unsupported_request'
    ) {
      await this.logAssistantEvent(user, {
        eventType: 'assistant_unsupported_request',
        pageKey: assistantTurnState.pageKey,
        section: assistantTurnState.section,
        intent: assistantTurnState.classification.primaryIntent,
        contentSnippet: messageContent.slice(0, 240),
        metadata: {
          matchedIntents: assistantTurnState.classification.matchedIntents,
          unsupportedReason:
            typeof turn.metadata?.unsupportedReason === 'string'
              ? turn.metadata.unsupportedReason
              : null,
          suggestedService:
            typeof turn.metadata?.serviceRecommendation === 'string'
              ? turn.metadata.serviceRecommendation
              : null,
        },
      });
    }

    return {
      userMessage,
      assistantMessage,
    };
  }

  private async prepareAssistantTurnState(input: {
    user: AuthUser;
    message: string;
    context: AssistantContextInput;
    history: AssistantHistoryEntry[];
    previousMemory: AssistantConversationMemory | null;
  }) {
    const pageKey = deriveAssistantPageKey(
      input.user.role,
      input.context.pagePath,
      input.context,
    );
    const section = deriveAssistantSection(input.context);
    const understandingDiagnostics = createAssistantLlmCallDiagnostics({
      layer: 'understanding',
      apiKeyPresent: this.llmUnderstanding.isEnabled(),
      model: this.llmUnderstanding.getModelName(),
      baseUrl: this.llmUnderstanding.getBaseUrl(),
    });
    const composerDiagnostics = createAssistantLlmCallDiagnostics({
      layer: 'composer',
      apiKeyPresent: this.llmComposer.isEnabled(),
      model: this.llmComposer.getModelName(),
      baseUrl: this.llmComposer.getBaseUrl(),
    });
    const understanding = await this.llmUnderstanding.understand({
      userMessage: input.message,
      role: input.user.role,
      pageKey,
      section,
      pagePath: input.context.pagePath ?? null,
      pageTitle: input.context.pageTitle ?? null,
      contextMetadata: this.toObjectRecord(
        input.context.metadata as Prisma.JsonValue,
      ),
      memory: input.previousMemory,
      history: input.history,
    }, understandingDiagnostics);
    const analysisMessage =
      understanding?.normalizedMessage?.trim() || input.message;
    const entities = extractAssistantEntities({
      message: analysisMessage,
      context: input.context,
      history: input.history,
      role: input.user.role,
      memory: input.previousMemory,
      understanding,
    });
    const classification = classifyAssistantInput({
      message: analysisMessage,
      context: input.context,
      history: input.history,
      memory: input.previousMemory,
      entities,
      understanding,
    });
    const activeMemory = mergeAssistantMemory({
      previous: input.previousMemory,
      context: input.context,
      role: input.user.role,
      entities,
      classification,
    });
    const requestContext = attachAssistantStateToContext({
      context: input.context,
      history: input.history,
      memory: activeMemory,
      classification,
      entities,
      understanding,
    });

    return {
      understanding,
      analysisMessage,
      entities,
      classification,
      activeMemory,
      requestContext,
      pageKey,
      section,
      turnState: {
        history: input.history,
        classification,
        memory: activeMemory,
        entities,
        understanding,
        diagnostics: {
          understanding: understandingDiagnostics,
          composer: composerDiagnostics,
        },
      } satisfies AssistantTurnState,
    };
  }

  private attachUnderstandingToTurn(
    turn: AssistantTurn,
    understanding: AssistantLlmUnderstandingOutput | null,
    diagnostics?: AssistantPipelineDiagnostics | null,
  ): AssistantTurn {
    if (!understanding) {
      if (!diagnostics) {
        return turn;
      }

      return {
        ...turn,
        metadata: {
          ...turn.metadata,
          llmUnderstandingUsed: false,
          llmUnderstandingDiagnostics: diagnostics.understanding,
        },
      };
    }

    return {
      ...turn,
      metadata: {
        ...turn.metadata,
        assistantUnderstanding: understanding,
        llmUnderstandingUsed: true,
        llmUnderstandingLanguage: understanding.language,
        llmUnderstandingIntent: understanding.primaryIntent,
        llmUnderstandingQueryType: understanding.queryType,
        llmUnderstandingConfidence: understanding.confidence,
        ...(diagnostics
          ? {
              llmUnderstandingDiagnostics: diagnostics.understanding,
            }
          : {}),
      },
    };
  }

  private createAssistantPipelineDebugTrace(input: {
    user: AuthUser;
    message: string;
    context: AssistantContextInput;
    state: AssistantTurnState;
  }): AssistantPipelineDebugTrace {
    const understanding = input.state.understanding;
    const normalizedMessage =
      understanding?.normalizedMessage?.trim() || input.message.trim();
    const originalIntent = understanding?.primaryIntent ?? 'unknown';
    const overriddenIntent = input.state.classification.primaryIntent;
    const detectedLanguage =
      understanding?.language?.trim() || detectSourceLanguage(input.message);
    const retrievalTarget = this.describeRetrievalTarget(input);
    const explanation =
      understanding?.followUpContext?.trim() ||
      understanding?.clarificationQuestion?.trim() ||
      null;
    const hasRetrievalContext = Boolean(
      retrievalTarget ||
        ['retrieval', 'booking', 'operational', 'follow_up', 'clarification'].includes(
          understanding?.queryType ?? '',
        ),
    );

    return {
      rawUserMessage: input.message,
      detectedLanguage,
      normalizedMessage,
      llm: input.state.diagnostics,
      understanding: {
        intent: originalIntent,
        secondaryIntents: understanding?.secondaryIntents ?? [],
        queryType: understanding?.queryType ?? null,
        timeframe: understanding?.timeframe?.trim() || null,
        retrievalTarget: this.describeRetrievalTarget(input),
        bookingVsRetrieval:
          understanding?.queryType ?? null,
        confidence:
          typeof understanding?.confidence === 'number'
            ? understanding.confidence
            : null,
        ambiguity: understanding?.ambiguity ?? null,
        frustration:
          typeof understanding?.frustration === 'boolean'
            ? understanding.frustration
            : null,
        explanation,
        entities: this.sanitizeDebugRecord(input.state.entities),
      },
      deterministicIntentOverride: {
        original: originalIntent,
        overridden: overriddenIntent,
        reason: this.describeIntentOverride(
          input,
          originalIntent,
          overriddenIntent,
        ),
      },
      entityExtraction: this.sanitizeDebugRecord(input.state.entities),
      retrieval: hasRetrievalContext
        ? {
            searchText: normalizedMessage || null,
            semanticQuery:
              understanding?.normalizedMessage?.trim() || normalizedMessage || null,
            appliedFilters: this.sanitizeDebugRecord({
              queryType: understanding?.queryType ?? null,
              retrievalTarget,
              language: detectedLanguage,
              bookingStatus: input.state.memory?.bookingStatus ?? null,
              paymentStatus: input.state.memory?.paymentStatus ?? null,
              contractStatus: input.state.memory?.contractStatus ?? null,
              city: input.state.memory?.city ?? null,
              budgetPreference: input.state.memory?.budgetPreference ?? null,
              selectedBookingId: input.state.memory?.selectedBookingId ?? null,
              selectedProjectId: input.state.memory?.selectedProjectId ?? null,
            }),
            selectedScope: retrievalTarget,
            memoryReferences: this.sanitizeDebugRecord({
              currentRole: input.state.memory?.currentRole ?? null,
              currentPagePath: input.state.memory?.currentPagePath ?? null,
              currentPageTitle: input.state.memory?.currentPageTitle ?? null,
              lastSearchQuery: input.state.memory?.lastSearchQuery ?? null,
              lastPrimaryIntent: input.state.memory?.lastPrimaryIntent ?? null,
              selectedBookingId: input.state.memory?.selectedBookingId ?? null,
              selectedProjectId: input.state.memory?.selectedProjectId ?? null,
              city: input.state.memory?.city ?? null,
              budgetPreference: input.state.memory?.budgetPreference ?? null,
              meaningfulTurns: input.state.memory?.meaningfulTurns ?? null,
            }),
            results: [],
          }
        : null,
      final: null,
    };
  }

  private finalizeAssistantPipelineDebugTrace(
    trace: AssistantPipelineDebugTrace,
    turn: AssistantTurn,
  ) {
    trace.final = {
      responseStyle:
        typeof turn.metadata?.responseStyle === 'string'
          ? turn.metadata.responseStyle
          : null,
      actionChips: turn.actions.map((action) => action.label),
      llmComposerUsed:
        typeof turn.metadata?.llmComposed === 'boolean'
          ? turn.metadata.llmComposed
          : false,
      finalReplyPayload: {
        content: turn.content,
        actions: turn.actions,
        metadata: turn.metadata ?? null,
      },
    };
  }

  private logAssistantPipelineDebugTrace(trace: AssistantPipelineDebugTrace) {
    if (!this.isDebugTracingEnabled()) {
      return;
    }

    console.log(`Assistant pipeline trace: ${JSON.stringify(trace, null, 2)}`);
  }

  private isDebugTracingEnabled() {
    return process.env.NODE_ENV !== 'production';
  }

  private describeIntentOverride(
    input: {
      message: string;
      context: AssistantContextInput;
      state: AssistantTurnState;
    },
    originalIntent: string,
    overriddenIntent: string,
  ) {
    if (originalIntent === overriddenIntent) {
      return 'No override';
    }

    const normalized = input.message.toLowerCase();

    if (
      overriddenIntent === 'booking_follow_up' ||
      overriddenIntent === 'booking_inquiry'
    ) {
      if (this.isBookingFollowUpIntent(input.message, input.state.history)) {
        return 'booking memory and follow-up language outweighed retrieval wording';
      }

      if (this.isWorkspaceSearchIntent(normalized, input.context)) {
        return 'booking keywords and page context outweighed search wording';
      }

      return 'booking details outweighed retrieval wording';
    }

    if (overriddenIntent === 'search_request') {
      return 'search keywords or lookup phrasing outweighed booking wording';
    }

    if (OPERATIONAL_INTENTS.has(overriddenIntent as AssistantIntent)) {
      return 'operational attention wording outweighed booking wording';
    }

    if (overriddenIntent === 'clarification_request') {
      return 'ambiguity or correction wording forced clarification';
    }

    if (overriddenIntent === 'support_escalation') {
      return 'frustration or support wording forced escalation';
    }

    return 'deterministic routing chose a different lane';
  }

  private describeRetrievalTarget(input: {
    message: string;
    context: AssistantContextInput;
    state: AssistantTurnState;
  }) {
    const normalized = input.message.toLowerCase();
    const intents = input.state.classification.matchedIntents;

    if (
      intents.includes('payment_help') ||
      this.isPaymentsIntent(normalized) ||
      this.includesAny(normalized, ['payment', 'payments', 'invoice', 'invoice', 'overdue'])
    ) {
      return 'payments';
    }

    if (
      intents.includes('contract_help') ||
      this.isContractsIntent(normalized) ||
      this.includesAny(normalized, ['contract', 'contracts', 'agreement', 'signed'])
    ) {
      return 'contracts';
    }

    if (
      intents.includes('unread_messages_help') ||
      this.isUnreadChatsIntent(normalized) ||
      this.includesAny(normalized, ['chat', 'chats', 'message', 'messages', 'unread'])
    ) {
      return 'chats';
    }

    if (
      intents.includes('pending_tasks') ||
      intents.includes('stalled_projects') ||
      intents.includes('blocked_bookings') ||
      this.includesAny(normalized, ['task', 'tasks', 'project', 'projects', 'blocked', 'stalled'])
    ) {
      return 'projects';
    }

    if (
      intents.includes('operational_summary') ||
      intents.includes('pending_help') ||
      intents.includes('summary_request')
    ) {
      return 'dashboard';
    }

    if (
      intents.includes('search_request') ||
      this.isWorkspaceSearchIntent(normalized, input.context) ||
      this.isBookingFollowUpIntent(input.message, input.state.history)
    ) {
      return 'bookings';
    }

    return null;
  }

  private sanitizeDebugRecord(input: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    );
  }

  private describeWorkspaceSearchScope(input: {
    hasBookingFocus: boolean;
    hasPaymentFocus: boolean;
    hasContractFocus: boolean;
    hasProjectFocus: boolean;
    hasChatFocus: boolean;
    hasNotificationFocus: boolean;
    hasConversationFocus: boolean;
    hasClientFocus: boolean;
    hasVendorFocus: boolean;
    broadSearch: boolean;
  }) {
    if (input.hasBookingFocus) return 'bookings';
    if (input.hasPaymentFocus) return 'payments';
    if (input.hasContractFocus) return 'contracts';
    if (input.hasProjectFocus) return 'projects';
    if (input.hasChatFocus) return 'chats';
    if (input.hasNotificationFocus) return 'notifications';
    if (input.hasConversationFocus) return 'conversations';
    if (input.hasClientFocus) return 'clients';
    if (input.hasVendorFocus) return 'vendors';
    return input.broadSearch ? 'workspace' : 'workspace';
  }

  private buildWorkspaceSearchDebugResults(input: {
    searchText: string;
    lowerMessage: string;
    priorMemory: Record<string, unknown> | null;
    bookings: any[];
    payments: any[];
    contracts: any[];
    projects: any[];
    threads: any[];
    notifications: any[];
    conversations: any[];
    clients: any[];
    vendors: any[];
  }) {
    type DebugSearchResult = {
      entityId: string;
      name: string;
      city: string | null;
      score: number;
      whyMatched: string;
    };

    const results: DebugSearchResult[] = [];
    const searchText = input.searchText.trim().toLowerCase();
    const searchTerms = searchText
      ? Array.from(new Set(searchText.split(/\s+/g).filter(Boolean)))
      : [];
    const followUpSignal = this.includesAny(input.lowerMessage, [
      'same',
      'that',
      'those',
      'these',
      'another',
      'more',
      'again',
      'previous',
      'older',
    ]);

    const addResult = (item: {
      entityId: string;
      name: string;
      city: string | null;
      fields: Array<string | null | undefined>;
      baseScore: number;
      categoryReason: string;
      index: number;
    }) => {
      const normalizedFields = item.fields
        .map((field) => field?.trim().toLowerCase() ?? '')
        .filter(Boolean);
      const reasons: string[] = [];

      if (searchText) {
        if (normalizedFields.some((field) => field.includes(searchText))) {
          reasons.push('text match');
        } else if (
          searchTerms.some((term) =>
            normalizedFields.some((field) => field.includes(term)),
          )
        ) {
          reasons.push('keyword match');
        }
      } else {
        reasons.push('scope match');
      }

      if (
        this.includesAny(input.lowerMessage, [
          'recent',
          'latest',
          'newest',
          'current',
          'today',
          'this week',
        ])
      ) {
        reasons.push('recency wording');
      }

      if (
        this.includesAny(input.lowerMessage, [
          'overdue',
          'late',
          'past due',
          'pending',
          'unread',
          'blocked',
          'stalled',
          'missing',
          'unsigned',
        ])
      ) {
        reasons.push('status wording');
      }

      if (followUpSignal && input.priorMemory?.lastSearchQuery) {
        reasons.push('memory carry-over');
      }

      if (
        item.city &&
        searchText &&
        searchText.includes(item.city.toLowerCase())
      ) {
        reasons.push('city match');
      }

      const scoreBoost =
        (reasons.includes('text match') ? 0.1 : 0) +
        (reasons.includes('keyword match') ? 0.05 : 0) +
        (reasons.includes('city match') ? 0.04 : 0) +
        (reasons.includes('memory carry-over') ? 0.03 : 0) +
        (reasons.includes('recency wording') ? 0.02 : 0) +
        (reasons.includes('status wording') ? 0.02 : 0);
      const score = Math.max(
        0,
        Math.min(
          0.99,
          Number((item.baseScore - item.index * 0.02 + scoreBoost).toFixed(2)),
        ),
      );

      results.push({
        entityId: item.entityId,
        name: item.name,
        city: item.city,
        score,
        whyMatched: [
          item.categoryReason,
          ...reasons.slice(0, 3),
        ].join(' + '),
      });
    };

    input.bookings.forEach((lead, index) => {
      addResult({
        entityId: lead.id,
        name:
          lead.eventType ??
          lead.packageName ??
          lead.packageLabel ??
          `Booking ${lead.id.slice(0, 8)}`,
        city: lead.city ?? null,
        fields: [
          lead.eventType,
          lead.location,
          lead.city,
          lead.packageName,
          lead.packageLabel,
          lead.notes,
        ],
        baseScore: 0.96,
        categoryReason: 'booking match',
        index,
      });
    });

    input.payments.forEach((payment, index) => {
      const lead = payment.project?.contract?.proposal?.lead ?? null;
      addResult({
        entityId: payment.id,
        name: payment.type ?? `Payment ${payment.id.slice(0, 8)}`,
        city: lead?.city ?? null,
        fields: [
          payment.type,
          payment.notes,
          payment.gatewayOrderId,
          payment.transactionId,
          lead?.eventType,
          lead?.location,
          lead?.city,
          payment.project?.client?.name,
        ],
        baseScore: 0.94,
        categoryReason: 'payment match',
        index,
      });
    });

    input.contracts.forEach((contract, index) => {
      const lead = contract.proposal?.lead ?? null;
      addResult({
        entityId: contract.id,
        name: contract.status ?? `Contract ${contract.id.slice(0, 8)}`,
        city: lead?.city ?? null,
        fields: [
          contract.status,
          lead?.eventType,
          lead?.location,
          lead?.city,
          contract.project?.client?.name,
        ],
        baseScore: 0.92,
        categoryReason: 'contract match',
        index,
      });
    });

    input.projects.forEach((project, index) => {
      const lead = project.contract?.proposal?.lead ?? null;
      addResult({
        entityId: project.id,
        name: project.summary ?? project.status ?? `Project ${project.id.slice(0, 8)}`,
        city: lead?.city ?? null,
        fields: [
          project.summary,
          project.status,
          lead?.eventType,
          lead?.location,
          lead?.city,
        ],
        baseScore: 0.9,
        categoryReason: 'project match',
        index,
      });
    });

    input.threads.forEach((thread, index) => {
      addResult({
        entityId: thread.id,
        name: thread.lead?.eventType ?? `Chat ${thread.id.slice(0, 8)}`,
        city: thread.lead?.city ?? null,
        fields: [
          thread.lead?.eventType,
          thread.lead?.location,
          thread.lead?.city,
          (thread.messages ?? [])
            .map((message: any) => message.body)
            .join(' '),
        ],
        baseScore: 0.88,
        categoryReason: 'chat match',
        index,
      });
    });

    input.notifications.forEach((notification, index) => {
      addResult({
        entityId: notification.id,
        name: notification.title ?? `Notification ${notification.id.slice(0, 8)}`,
        city: null,
        fields: [notification.title, notification.body],
        baseScore: 0.76,
        categoryReason: 'notification match',
        index,
      });
    });

    input.conversations.forEach((conversation, index) => {
      addResult({
        entityId: conversation.id,
        name: conversation.title ?? `Conversation ${conversation.id.slice(0, 8)}`,
        city: null,
        fields: [
          conversation.title,
          conversation.preview,
          conversation.contexts?.[0]?.pageTitle,
        ],
        baseScore: 0.74,
        categoryReason: 'conversation match',
        index,
      });
    });

    input.clients.forEach((client, index) => {
      addResult({
        entityId: client.id,
        name: client.name ?? client.email ?? client.phone ?? `Client ${client.id.slice(0, 8)}`,
        city: null,
        fields: [client.name, client.email, client.phone],
        baseScore: 0.72,
        categoryReason: 'client match',
        index,
      });
    });

    input.vendors.forEach((vendor, index) => {
      addResult({
        entityId: vendor.id,
        name: vendor.name ?? `Vendor ${vendor.id.slice(0, 8)}`,
        city: null,
        fields: [vendor.name, vendor.serviceType, vendor.notes],
        baseScore: 0.7,
        categoryReason: 'vendor match',
        index,
      });
    });

    return results
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.name.localeCompare(right.name);
      })
      .slice(0, 5);
  }

  private async generateAssistantTurn(
    user: AuthUser,
    message: string,
    context: AssistantContextInput,
    state: AssistantTurnState,
    debugTrace?: AssistantPipelineDebugTrace | null,
  ): Promise<AssistantTurn> {
    const normalized = message.toLowerCase();
    const pageKey = deriveAssistantPageKey(
      user.role,
      context.pagePath,
      context,
    );
    const history = state.history;
    const intents = state.classification.matchedIntents;
    const primaryIntent = state.classification.primaryIntent;
    const entities = state.entities;
    const bookingMemory = this.extractBookingMemory(
      message,
      context,
      history,
      entities,
      state.memory,
    );
    const lead = await this.getLeadFromContext(user, context);
    const project = await this.getProjectFromContext(user, context, lead);

    if (primaryIntent === 'greeting' && !state.classification.isMeaningful) {
      return this.buildGreetingReply(user, pageKey, context, state.memory);
    }

    if (this.isIdentityQuestion(normalized)) {
      return this.buildIdentityReply(user, context, pageKey, state.memory);
    }

    if (this.isUserIdentityQuestion(normalized)) {
      return await this.buildUserIdentityReply(
        user,
        context,
        pageKey,
        state.memory,
        normalized,
      );
    }

    if (this.isCapabilityQuestion(normalized)) {
      return this.buildCapabilityReply(user, context, pageKey, state.memory);
    }

    if (this.isCasualChatQuestion(normalized) || primaryIntent === 'casual_chat') {
      return this.buildPersonalReply(
        user,
        context,
        pageKey,
        state.memory,
        normalized,
      );
    }

    if (
      this.isPersonalQuestion(normalized) ||
      primaryIntent === 'personal_question'
    ) {
      return this.buildPersonalReply(
        user,
        context,
        pageKey,
        state.memory,
        normalized,
      );
    }

    if (
      this.isUnsupportedPersonalDataQuestion(normalized) ||
      primaryIntent === 'unsupported_personal_data'
    ) {
      return this.buildUnsupportedPersonalDataReply(
        user,
        context,
        pageKey,
        state.memory,
        normalized,
      );
    }

    if (this.isOffTopicRequest(normalized) || primaryIntent === 'off_topic') {
      return this.buildOffTopicReply(
        user,
        context,
        pageKey,
        state.memory,
        normalized,
      );
    }

    if (
      OPERATIONAL_INTENTS.has(primaryIntent) ||
      intents.some((intent) => OPERATIONAL_INTENTS.has(intent as AssistantIntent))
    ) {
      const operationalIntent =
        (OPERATIONAL_INTENTS.has(primaryIntent)
          ? primaryIntent
          : intents.find((intent) =>
                OPERATIONAL_INTENTS.has(intent as AssistantIntent),
              )) ?? 'operational_summary';

      return this.buildOperationalReply(
        user,
        operationalIntent as AssistantIntent,
        context,
        pageKey,
        state.memory,
      );
    }

    if (
      this.isPageAboutIntent(normalized) ||
      primaryIntent === 'dashboard_help'
    ) {
      if (['general', 'home'].includes(deriveAssistantSection(context))) {
        return this.buildDashboardHelpReply(
          user,
          context,
          pageKey,
          lead,
          project,
          state.memory,
        );
      }

      return this.buildPageOverviewReply(user, context, pageKey, lead, project);
    }

    if (intents.includes('unsupported_request')) {
      return this.buildUnsupportedReply(
        user,
        context,
        message,
        state.classification,
        state.memory,
        pageKey,
      );
    }

    if (intents.includes('support_escalation')) {
      return this.buildEscalationReply(
        user,
        context,
        lead,
        project,
        message,
        state.classification,
        state.memory,
        pageKey,
      );
    }

    if (this.isAfterSubmitIntent(normalized)) {
      return this.buildAfterSubmitReply(user, context, lead, project);
    }

    if (
      intents.includes('next_step_help') ||
      this.isNextStepIntent(normalized)
    ) {
      return this.buildNextStepReply(user, lead, project, pageKey, context);
    }

    if (
      intents.includes('booking_inquiry') ||
      intents.includes('booking_follow_up') ||
      intents.includes('budget_discussion') ||
      intents.includes('service_recommendation')
    ) {
      const bookingConsultation = this.buildBookingConsultationReply(
        user,
        context,
        bookingMemory,
        state.classification,
        message,
      );

      if (bookingConsultation) {
        return bookingConsultation;
      }

      if (
        this.isCreateBookingIntent(normalized) ||
        primaryIntent === 'booking_follow_up' ||
        primaryIntent === 'booking_inquiry'
      ) {
        return this.buildCreateBookingReply(user, context, normalized);
      }
    }

    if (intents.includes('pending_help') || this.isPendingIntent(normalized)) {
      return this.buildPendingReply(user, lead, project, pageKey, context);
    }

    if (
      intents.includes('summary_request') ||
      this.isSummaryIntent(normalized)
    ) {
      return this.buildSummaryReply(user, lead, project, context);
    }

    if (
      intents.includes('search_request') ||
      this.isWorkspaceSearchIntent(normalized, context)
    ) {
      return this.buildWorkspaceSearchReply(
        user,
        context,
        message,
        pageKey,
        debugTrace ?? null,
      );
    }

    if (
      intents.includes('assignments_help') ||
      this.isAssignmentsIntent(normalized)
    ) {
      return this.buildAssignmentsReply(user, lead, project);
    }

    if (
      intents.includes('payment_reminder_request') ||
      this.isPaymentReminderIntent(normalized)
    ) {
      return this.buildPaymentReminderReply(user, lead, project, context);
    }

    if (intents.includes('draft_request') || this.isDraftIntent(normalized)) {
      return this.buildDraftReply(user, lead, project, context);
    }

    if (
      intents.includes('unread_messages_help') ||
      this.isUnreadChatsIntent(normalized)
    ) {
      return this.buildUnreadChatsReply(user);
    }

    if (intents.includes('payment_help') || this.isPaymentsIntent(normalized)) {
      return this.buildPaymentsReply(
        user,
        lead,
        project,
        context,
        message,
        state.memory,
      );
    }

    if (
      intents.includes('contract_help') ||
      this.isContractsIntent(normalized)
    ) {
      return this.buildContractsReply(
        user,
        lead,
        project,
        context,
        message,
        state.memory,
      );
    }

    if (
      intents.includes('proposal_help') ||
      this.isProposalIntent(normalized)
    ) {
      return this.buildProposalReply(user, lead);
    }

    if (
      intents.includes('next_event_help') ||
      this.isNextEventIntent(normalized)
    ) {
      return this.buildNextEventReply(user);
    }

    if (
      intents.includes('navigation_request') ||
      intents.includes('action_request') ||
      this.isNavigationIntent(normalized)
    ) {
      return this.buildNavigationReply(user, lead, project);
    }

    return this.buildFallbackReply(user, pageKey, context, state.memory, {
      message,
      classification: state.classification,
      history,
      understanding: state.understanding,
    });
  }

  private async buildPaymentsReply(
    user: AuthUser,
    lead: any | null,
    project: any | null,
    context: AssistantContextInput,
    message?: string,
    memory?: AssistantConversationMemory | null,
  ): Promise<AssistantTurn> {
    const effectiveLead = lead ?? project?.contract?.proposal?.lead ?? null;
    const effectiveProject =
      project ?? lead?.proposals?.[0]?.contract?.project ?? null;
    const contextPayments =
      effectiveProject?.payments?.filter(
        (payment: any) => !payment.deletedAt,
      ) ?? [];

    const payments =
      contextPayments.length > 0
        ? contextPayments
        : await this.prisma.payment.findMany({
            where: {
              deletedAt: null,
              status: {
                in: [PaymentStatus.PENDING, PaymentStatus.FAILED],
              },
              ...this.buildPaymentAccessWhere(user),
            },
            include: {
              project: {
                include: {
                  contract: {
                    include: {
                      proposal: {
                        include: {
                          lead: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
            take: 6,
          });

    if (!payments.length) {
      return {
        content: buildStructuredReply({
          summary:
            user.role === Role.CLIENT
              ? 'No pending payments are showing on your side right now.'
              : 'No unpaid invoices are showing right now.',
          details: [
            'I am not seeing overdue or failed payment milestones in the current scope.',
          ],
          nextActions: ['View bookings', 'Check contract status'],
        }),
        actions: [],
        metadata: {
          responseType: 'payments_summary',
          paymentCount: 0,
          totalOutstanding: 0,
        },
      };
    }

    const pendingPayments = payments.filter((payment: any) =>
      [PaymentStatus.PENDING, PaymentStatus.FAILED].includes(payment.status),
    );
    const outstanding = pendingPayments.reduce(
      (sum: number, payment: any) => sum + payment.amount,
      0,
    );
    const paidAmount =
      effectiveProject?.payments
        ?.filter((payment: any) => payment.status === PaymentStatus.PAID)
        ?.reduce((sum: number, payment: any) => sum + payment.amount, 0) ?? 0;
    const selectedPaymentId =
      typeof context.metadata?.selectedPaymentId === 'string'
        ? context.metadata.selectedPaymentId
        : null;
    const memoryTerms = [
      memory?.city,
      memory?.location,
      memory?.eventType,
      memory?.occasion,
    ]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.toLowerCase());
    const selectedPaymentByMemory =
      memoryTerms.length > 0
        ? payments.find((payment: any) => {
            const paymentLead = payment.project?.contract?.proposal?.lead;
            const haystack = [
              paymentLead?.location,
              paymentLead?.eventType,
              paymentLead?.occasion,
              payment.type,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

            return memoryTerms.some((term) => haystack.includes(term));
          })
        : null;

    if (
      typeof message === 'string' &&
      detectRepairSignal(message) &&
      !selectedPaymentByMemory &&
      payments.length > 1
    ) {
      return this.buildClarificationReply(
        user,
        context,
        effectiveLead,
        effectiveProject,
        message,
        null,
        memory,
        undefined,
        [],
      );
    }

    const selectedPayment =
      payments.find((payment: any) => payment.id === selectedPaymentId) ??
      selectedPaymentByMemory ??
      pendingPayments.find(
        (payment: any) =>
          payment.dueDate && new Date(payment.dueDate).getTime() < Date.now(),
      ) ??
      pendingPayments[0] ??
      payments[0] ??
      null;
    const selectedPaymentLead =
      selectedPayment?.project?.contract?.proposal?.lead ?? effectiveLead;
    const overduePayment = pendingPayments.find(
      (payment: any) =>
        payment.dueDate && new Date(payment.dueDate).getTime() < Date.now(),
    );
    const primaryLead =
      effectiveLead ?? payments[0].project.contract?.proposal?.lead ?? null;
    const primaryProject = effectiveProject ?? payments[0].project ?? null;
    const summary = selectedPayment
      ? `${selectedPayment.type} milestone is ${selectedPayment.status.toLowerCase()}${selectedPayment.dueDate ? ` and due ${this.formatDate(selectedPayment.dueDate)}` : ''}.`
      : `There are ${pendingPayments.length} unpaid payment item${pendingPayments.length === 1 ? '' : 's'} in the current scope.`;

    return {
      content: buildStructuredReply({
        summary,
        details: [
          selectedPaymentLead
            ? `Booking: ${selectedPaymentLead.eventType} at ${selectedPaymentLead.location ?? 'TBD'}`
            : null,
          effectiveProject?.payments?.length
            ? `Paid amount: ${this.formatCurrency(paidAmount)}`
            : null,
          `Pending amount: ${this.formatCurrency(outstanding)}`,
          overduePayment
            ? `Overdue milestone: ${overduePayment.type} for ${this.formatCurrency(overduePayment.amount)}`
            : null,
          selectedPayment
            ? `Selected payment: ${selectedPayment.type} for ${this.formatCurrency(selectedPayment.amount)}`
            : null,
        ],
        nextActions: [
          'View payments',
          'Draft payment reminder',
          'Open booking',
        ],
      }),
      actions: dedupeAssistantActions([
        ...this.buildEntityActions(user, primaryLead, primaryProject, {
          includePayments: true,
        }),
        createDraftAssistantAction(
          'payments-draft-reminder',
          'Draft payment reminder',
          'Draft payment reminder',
          'Prepare a polished reminder for the pending milestone.',
        ),
      ]),
      metadata: {
        responseType: 'payments_summary',
        paymentCount: pendingPayments.length,
        totalOutstanding: outstanding,
        paymentStatus: overduePayment ? 'OVERDUE' : 'PENDING',
        paymentId: selectedPayment?.id ?? null,
      },
    };
  }

  private async buildContractsReply(
    user: AuthUser,
    lead: any | null,
    project: any | null,
    context: AssistantContextInput,
    message?: string,
    memory?: AssistantConversationMemory | null,
  ): Promise<AssistantTurn> {
    const effectiveLead = lead ?? project?.contract?.proposal?.lead ?? null;
    const effectiveProject =
      project ?? lead?.proposals?.[0]?.contract?.project ?? null;
    const contextContract =
      effectiveLead?.proposals?.[0]?.contract ??
      effectiveProject?.contract ??
      null;
    const contracts =
      contextContract &&
      [
        ContractStatus.DRAFT,
        ContractStatus.SENT,
        ContractStatus.SIGNED,
      ].includes(contextContract.status)
        ? [contextContract]
        : await this.prisma.contract.findMany({
            where: {
              deletedAt: null,
              status: {
                in: [
                  ContractStatus.DRAFT,
                  ContractStatus.SENT,
                  ContractStatus.SIGNED,
                ],
              },
              ...this.buildContractAccessWhere(user),
            },
            include: {
              proposal: {
                include: {
                  lead: true,
                },
              },
              project: {
                include: {
                  client: {
                    select: assistantUserSelect,
                  },
                },
              },
              versions: {
                orderBy: { createdAt: 'desc' },
                take: 8,
              },
            },
            orderBy: { updatedAt: 'desc' },
            take: 5,
          });

    if (!contracts.length) {
      return {
        content: buildStructuredReply({
          summary: 'No contract records are in scope right now.',
          details: [
            'I am not seeing draft, sent, or signed agreements here yet.',
          ],
          nextActions: ['Open booking', 'View payments'],
        }),
        actions: [],
        metadata: {
          responseType: 'contract_summary',
          contractCount: 0,
        },
      };
    }

    const selectedContractId =
      typeof context.metadata?.selectedContractId === 'string'
        ? context.metadata.selectedContractId
        : null;
    const memoryTerms = [
      memory?.city,
      memory?.location,
      memory?.eventType,
      memory?.occasion,
    ]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.toLowerCase());
    const selectedContractByMemory =
      memoryTerms.length > 0
        ? contracts.find((contract: any) => {
            const contractLead = contract?.proposal?.lead;
            const haystack = [
              contractLead?.location,
              contractLead?.eventType,
              contractLead?.occasion,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

            return memoryTerms.some((term) => haystack.includes(term));
          })
        : null;

    if (
      typeof message === 'string' &&
      detectRepairSignal(message) &&
      !selectedContractByMemory &&
      contracts.length > 1
    ) {
      return this.buildClarificationReply(
        user,
        context,
        effectiveLead,
        effectiveProject,
        message,
        null,
        memory,
        undefined,
        [],
      );
    }

    const selectedContract =
      contracts.find((contract: any) => contract.id === selectedContractId) ??
      selectedContractByMemory ??
      contracts[0];
    const latestVersion = selectedContract?.versions?.[0] ?? null;
    const revisionCount = selectedContract?.versions?.length ?? 0;
    const contractLead = selectedContract?.proposal?.lead ?? effectiveLead;
    const summary =
      selectedContract.status === ContractStatus.SIGNED
        ? `The contract is signed and locked for execution.`
        : selectedContract.status === ContractStatus.SENT
          ? `The contract is sent and still waiting for signature.`
          : `The contract is still in draft and has not been issued yet.`;

    return {
      content: buildStructuredReply({
        summary,
        details: [
          contractLead
            ? `Booking: ${contractLead.eventType} on ${this.formatDate(contractLead.eventDate)}`
            : null,
          `Contract stage: ${selectedContract.status}`,
          `Revision count: ${revisionCount}`,
          latestVersion
            ? `Latest uploaded version: v${latestVersion.version} on ${this.formatDate(latestVersion.createdAt)}`
            : 'No uploaded contract revision is attached yet',
          selectedContract.signedAt
            ? `Signed at: ${this.formatDate(selectedContract.signedAt)}`
            : null,
        ],
        nextActions: [
          'Show latest version',
          selectedContract.status === ContractStatus.SIGNED
            ? 'Open project'
            : 'Draft contract follow-up',
          'Open booking',
        ],
      }),
      actions: dedupeAssistantActions([
        ...this.buildEntityActions(
          user,
          contractLead ?? null,
          selectedContract.project ?? effectiveProject ?? null,
        ),
        createDraftAssistantAction(
          'contracts-draft-followup',
          'Draft contract follow-up',
          'Draft contract follow-up',
          'Prepare a concise agreement follow-up.',
        ),
      ]),
      metadata: {
        responseType: 'contract_summary',
        contractCount: contracts.length,
        contractStatus: selectedContract.status,
        contractId: selectedContract.id,
        contractRevisionCount: revisionCount,
      },
    };
  }

  private async buildProposalReply(
    user: AuthUser,
    lead: any | null,
  ): Promise<AssistantTurn> {
    const proposal =
      lead?.proposals?.[0] ??
      (await this.prisma.proposal.findFirst({
        where: {
          deletedAt: null,
          ...this.buildProposalAccessWhere(user),
        },
        include: {
          lead: true,
          contract: {
            include: {
              project: {
                include: {
                  client: {
                    select: assistantUserSelect,
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }));

    if (!proposal) {
      return {
        content: 'I could not find a proposal in scope yet.',
        actions: [],
      };
    }

    return {
      content: [
        `Latest proposal: \`${proposal.title}\` for \`${this.formatCurrency(proposal.price)}\`.`,
        `Status is \`${proposal.status}\` and the timeline is ${proposal.timeline}.`,
      ].join('\n'),
      actions: this.buildEntityActions(
        user,
        proposal.lead ?? lead ?? null,
        proposal.contract?.project ?? null,
      ),
      metadata: {
        proposalId: proposal.id,
        proposalStatus: proposal.status,
      },
    };
  }

  private async buildNextEventReply(user: AuthUser): Promise<AssistantTurn> {
    if (user.role === Role.VENDOR) {
      const project = await this.prisma.project.findFirst({
        where: {
          deletedAt: null,
          ...this.buildProjectAccessWhere(user),
          status: {
            notIn: ['COMPLETED', 'CANCELLED'],
          },
        },
        include: assistantProjectInclude,
      });

      if (!project) {
        return {
          content: 'No active vendor assignments are queued right now.',
          actions: [],
        };
      }

      const lead = project.contract.proposal.lead;
      return {
        content: `Your next assignment is ${lead.eventType} at ${lead.location} on ${this.formatDate(lead.eventDate)}.`,
        actions: this.buildEntityActions(user, lead, project),
        metadata: {
          leadId: lead.id,
          projectId: project.id,
        },
      };
    }

    const lead = await this.prisma.lead.findFirst({
      where: {
        deletedAt: null,
        eventDate: {
          gte: new Date(),
        },
        ...this.buildLeadAccessWhere(user),
      },
      include: assistantLeadInclude,
      orderBy: { eventDate: 'asc' },
    });

    if (!lead) {
      return {
        content:
          user.role === Role.CLIENT
            ? 'No upcoming events are showing just yet.'
            : 'I could not find an upcoming event in your current scope.',
        actions: [],
      };
    }

    const project = lead.proposals?.[0]?.contract?.project ?? null;
    return {
      content: `Next up is ${lead.eventType} at ${lead.location} on ${this.formatDate(lead.eventDate)}.`,
      actions: this.buildEntityActions(user, lead, project),
      metadata: {
        leadId: lead.id,
        projectId: project?.id ?? null,
      },
    };
  }

  private async buildUnreadChatsReply(user: AuthUser): Promise<AssistantTurn> {
    if (user.role === Role.VENDOR) {
      return {
        content: buildStructuredReply({
          summary:
            'Unread chat triage is currently lighter in the vendor workspace.',
          details: [
            'I can still help with project summaries, payment status, deadlines, and upload reminders here.',
          ],
          nextActions: ['Open assignments', 'Summarize project'],
        }),
        actions: [],
        metadata: {
          responseType: 'unread_chat_summary',
          unreadThreadCount: 0,
        },
      };
    }

    const threads = await this.prisma.conversationThread.findMany({
      where: {
        lead: {
          is: this.buildLeadAccessWhere(user),
        },
        messages: {
          some: {
            senderId: {
              not: user.userId,
            },
            readAt: null,
          },
        },
      },
      include: {
        lead: true,
        messages: {
          where: {
            senderId: {
              not: user.userId,
            },
            readAt: null,
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    if (!threads.length) {
      return {
        content: buildStructuredReply({
          summary:
            'No unread conversation threads are waiting on you right now.',
          details: [
            'I am not seeing any unread client or internal chat threads in the current scope.',
          ],
          nextActions: ['Open chat workspace', 'Show pending actions'],
        }),
        actions: [],
        metadata: {
          responseType: 'unread_chat_summary',
          unreadThreadCount: 0,
        },
      };
    }

    const unreadMessageCount = threads.reduce(
      (sum, thread) => sum + thread.messages.length,
      0,
    );

    return {
      content: buildStructuredReply({
        summary: `You have ${threads.length} unread chat thread${threads.length === 1 ? '' : 's'} with ${unreadMessageCount} unread message${unreadMessageCount === 1 ? '' : 's'} in total.`,
        details: threads.map(
          (thread) =>
            `${thread.lead.eventType} at ${thread.lead.location} has ${thread.messages.length} unread message${thread.messages.length === 1 ? '' : 's'}`,
        ),
        nextActions: [
          'Open chat workspace',
          'Draft reply',
          'Show related booking',
        ],
      }),
      actions: [
        {
          id: 'open-chat-workspace',
          type: 'NAVIGATE',
          label: 'Open chat workspace',
          href: this.getChatHref(user),
          description: 'Jump straight into the messaging workspace.',
        },
      ],
      metadata: {
        responseType: 'unread_chat_summary',
        unreadThreadCount: threads.length,
        unreadMessageCount,
      },
    };
  }

  private async buildOperationalReply(
    user: AuthUser,
    intent: AssistantIntent,
    context: AssistantContextInput,
    pageKey: string,
    memory?: AssistantConversationMemory | null,
  ): Promise<AssistantTurn> {
    const report = await this.operationalService.getOperationalSummary(user);
    const summary = this.buildOperationalSummaryLead(user, intent, report);
    const details = this.buildOperationalDetails(intent, report);
    const nextActions = this.buildOperationalNextActions(intent, report, user);
    const actions = this.buildOperationalActions(intent, report, user);

    return {
      content: buildStructuredReply({
        summary,
        details,
        nextActions,
      }),
      actions: dedupeAssistantActions(actions).slice(0, 4),
      metadata: {
        responseType: intent,
        pageKey,
        section: deriveAssistantSection(context),
        memory,
        operationalCounts: report.counts,
        operationalTopIssues: report.topIssues
          .slice(0, 4)
          .map((item) => item.title),
      },
    };
  }

  private buildOperationalSummaryLead(
    user: AuthUser,
    intent: AssistantIntent,
    report: AssistantOperationalSummary,
  ) {
    const counts = report.counts;
    const pluralize = (value: number, singular: string) =>
      `${value} ${singular}${value === 1 ? '' : 's'}`;

    switch (intent) {
      case 'pending_tasks':
        return counts.pendingTasks
          ? `You have ${pluralize(counts.pendingTasks, 'open task')} across the active work.`
          : 'No pending tasks are showing right now.';
      case 'overdue_items':
        return counts.overduePayments || counts.overdueTasks || counts.unsignedContracts
          ? `You currently have ${pluralize(
              counts.overduePayments + counts.overdueTasks,
              'overdue item',
            )} in payments and tasks, plus ${pluralize(
              counts.unsignedContracts,
              'unsigned contract',
            )}.`
          : 'No overdue items are showing right now.';
      case 'upcoming_bookings':
        return counts.upcomingBookings
          ? `${pluralize(counts.upcomingBookings, 'upcoming booking')} need attention in the next 14 days.`
          : 'No upcoming bookings need attention in the next 14 days.';
      case 'blocked_bookings':
        return counts.blockedBookings
          ? `${pluralize(counts.blockedBookings, 'booking')} are blocked or at risk.`
          : 'No blocked bookings are showing right now.';
      case 'stalled_projects':
        return counts.stalledProjects
          ? `${pluralize(counts.stalledProjects, 'project')} have gone quiet for more than a week.`
          : 'No stalled projects are showing right now.';
      case 'unread_items':
        if (counts.unreadThreads && counts.unreadNotifications) {
          return `You have ${pluralize(
            counts.unreadThreads,
            'unread chat thread',
          )} and ${pluralize(counts.unreadNotifications, 'unread notification')}.`;
        }

        if (counts.unreadThreads) {
          return `You have ${pluralize(counts.unreadThreads, 'unread chat thread')}.`;
        }

        if (counts.unreadNotifications) {
          return `You have ${pluralize(counts.unreadNotifications, 'unread notification')}.`;
        }

        return 'Nothing unread is waiting right now.';
      case 'missing_assignments':
        return counts.missingAssignments
          ? `${pluralize(counts.missingAssignments, 'booking')} are missing staff coverage.`
          : 'No bookings are missing staff coverage right now.';
      case 'pending_approvals':
        return counts.pendingApprovals
          ? `${pluralize(counts.pendingApprovals, 'proposal')} are waiting on approval.`
          : 'No approvals are waiting right now.';
      case 'overdue_payments':
        return counts.overduePayments
          ? `You have ${pluralize(
              counts.overduePayments,
              'overdue payment',
            )} totaling ${this.formatCurrency(counts.overduePaymentAmount)}.`
          : 'No overdue payments are showing right now.';
      case 'unsigned_contracts':
        return counts.unsignedContracts
          ? `${pluralize(counts.unsignedContracts, 'contract')} are still waiting on signature.`
          : 'No unsigned contracts are showing right now.';
      case 'operational_summary':
      default: {
        if (report.isEmpty) {
          return 'Everything looks clean right now. No overdue payments, blocked bookings, or unsigned contracts.';
        }

        const risks = [
          counts.overduePayments
            ? `${pluralize(counts.overduePayments, 'overdue payment')}`
            : null,
          counts.unsignedContracts
            ? `${pluralize(counts.unsignedContracts, 'unsigned contract')}`
            : null,
          counts.missingAssignments
            ? `${counts.missingAssignments} booking${counts.missingAssignments === 1 ? '' : 's'} without staff`
            : null,
          counts.unreadThreads
            ? `${pluralize(counts.unreadThreads, 'unread chat thread')}`
            : null,
          counts.overdueTasks ? `${pluralize(counts.overdueTasks, 'overdue task')}` : null,
        ].filter(Boolean) as string[];

        return risks.length
          ? `Right now the biggest risks are ${risks.slice(0, 3).join(', ')}.`
          : 'Everything looks clean right now. No overdue payments, blocked bookings, or unsigned contracts.';
      }
    }
  }

  private buildOperationalDetails(
    intent: AssistantIntent,
    report: AssistantOperationalSummary,
  ) {
    const bucket = this.getOperationalBucket(intent, report);
    const items = bucket.items.length ? bucket.items : report.topIssues;

    if (!items.length) {
      return report.calmState.length
        ? report.calmState
        : ['Nothing urgent is showing in this lane right now.'];
    }

    return items.slice(0, 4).map((item) => this.formatOperationalRecord(item));
  }

  private buildOperationalNextActions(
    intent: AssistantIntent,
    report: AssistantOperationalSummary,
    user: AuthUser,
  ) {
    const labels = this.getOperationalActionLabels(intent, report, user);
    return labels;
  }

  private buildOperationalActions(
    intent: AssistantIntent,
    report: AssistantOperationalSummary,
    user: AuthUser,
  ) {
    const actions: AssistantAction[] = [];
    const topBooking = report.blockedBookings.items[0] ?? report.upcomingBookings.items[0];
    const topTask = report.pendingTasks.items[0];
    const topPayment = report.overduePayments.items[0];
    const topContract = report.unsignedContracts.items[0];
    const topUnread = report.unread.threads.items[0];
    const topProject = report.stalledProjects.items[0] ?? report.missingAssignments.items[0];

    switch (intent) {
      case 'pending_tasks':
        if (topTask?.projectId) {
          actions.push(
            createNavigateAssistantAction(
              'ops-open-task',
              'Show pending tasks',
              this.getProjectHref(user, topTask.projectId, topTask.leadId ?? null),
              'Open the project that has the open task.',
            ),
          );
        }
        break;
      case 'overdue_items':
        if (topPayment?.paymentId) {
          actions.push(
            createNavigateAssistantAction(
              'ops-open-overdue-payments',
              'Show overdue payments',
              this.getPaymentsHref(user, topPayment.leadId ?? null, topPayment.projectId ?? null),
              'Open the payment queue for the most urgent item.',
            ),
          );
        }
        if (topTask?.projectId) {
          actions.push(
            createNavigateAssistantAction(
              'ops-open-overdue-tasks',
              'Show overdue tasks',
              this.getProjectHref(user, topTask.projectId, topTask.leadId ?? null),
              'Open the project that still has overdue tasks.',
            ),
          );
        }
        if (topContract?.leadId) {
          actions.push(
            createNavigateAssistantAction(
              'ops-open-overdue-contracts',
              'Show unsigned contracts',
              this.getContractsHref(user, topContract.leadId),
              'Open the contract queue for the most urgent record.',
            ),
          );
        }
        break;
      case 'upcoming_bookings':
      case 'blocked_bookings':
      case 'missing_assignments':
        if (topBooking?.leadId) {
          actions.push(
            createNavigateAssistantAction(
              'ops-open-booking',
              intent === 'blocked_bookings'
                ? 'Show blocked bookings'
                : intent === 'missing_assignments'
                  ? 'Show unassigned bookings'
                  : 'Show upcoming bookings',
              this.getLeadHref(user, topBooking.leadId),
              'Open the booking that needs the most attention.',
            ),
          );
        }
        break;
      case 'stalled_projects':
        if (topProject?.projectId) {
          actions.push(
            createNavigateAssistantAction(
              'ops-open-stalled-project',
              'Show stalled projects',
              this.getProjectHref(user, topProject.projectId, topProject.leadId ?? null),
              'Open the stalled project that needs the next move.',
            ),
          );
        }
        break;
      case 'unread_items':
        actions.push(
          createNavigateAssistantAction(
            'ops-open-chat',
            'Show unread chats',
            topUnread?.leadId
              ? `${this.getChatHref(user)}?bookingId=${topUnread.leadId}`
              : this.getChatHref(user),
            'Open the chat workspace.',
          ),
        );
        if (report.unread.notifications.count > 0) {
          actions.push(
            createNavigateAssistantAction(
              'ops-open-alerts',
              'Show alerts',
              this.getNotificationsHref(user),
              'Open unread notifications.',
            ),
          );
        }
        break;
      case 'pending_approvals':
        if (topContract?.leadId) {
          actions.push(
            createNavigateAssistantAction(
              'ops-open-approvals',
              'Show unsigned contracts',
              this.getContractsHref(user, topContract.leadId),
              'Open the contract waiting on approval.',
            ),
          );
        }
        if (topBooking?.leadId) {
          actions.push(
            createDraftAssistantAction(
              'ops-draft-followup',
              'Draft follow-up',
              `Draft a follow-up for ${topBooking.title}.`,
              'Write a short approval follow-up.',
            ),
          );
        }
        break;
      case 'overdue_payments':
        if (topPayment?.paymentId) {
          actions.push(
            createNavigateAssistantAction(
              'ops-open-payments',
              'Show overdue payments',
              this.getPaymentsHref(user, topPayment.leadId ?? null, topPayment.projectId ?? null),
              'Open the payment queue.',
            ),
          );
          actions.push(
            createDraftAssistantAction(
              'ops-draft-payment-reminder',
              'Draft reminder',
              `Draft a payment reminder for ${topPayment.title}.`,
              'Prepare a payment reminder for the overdue item.',
            ),
          );
        }
        break;
      case 'unsigned_contracts':
        if (topContract?.leadId) {
          actions.push(
            createNavigateAssistantAction(
              'ops-open-contracts',
              'Show unsigned contracts',
              this.getContractsHref(user, topContract.leadId),
              'Open the contract waiting on signature.',
            ),
          );
        }
        if (topBooking?.leadId) {
          actions.push(
            createDraftAssistantAction(
              'ops-draft-contract-followup',
              'Draft follow-up',
              `Draft a contract follow-up for ${topBooking.title}.`,
              'Prepare a short signature follow-up.',
            ),
          );
        }
        break;
      case 'operational_summary':
      default:
        if (report.counts.overduePayments > 0 && topPayment?.paymentId) {
          actions.push(
            createNavigateAssistantAction(
              'ops-summary-payments',
              'Show overdue payments',
              this.getPaymentsHref(user, topPayment.leadId ?? null, topPayment.projectId ?? null),
              'Open overdue payments.',
            ),
          );
        }
        if (report.counts.unsignedContracts > 0 && topContract?.leadId) {
          actions.push(
            createNavigateAssistantAction(
              'ops-summary-contracts',
              'Show unsigned contracts',
              this.getContractsHref(user, topContract.leadId),
              'Open unsigned contracts.',
            ),
          );
        }
        if (report.counts.blockedBookings > 0 && topBooking?.leadId) {
          actions.push(
            createNavigateAssistantAction(
              'ops-summary-bookings',
              'Show blocked bookings',
              this.getLeadHref(user, topBooking.leadId),
              'Open the most urgent booking.',
            ),
          );
        }
        if (report.unread.threads.count > 0) {
          actions.push(
            createNavigateAssistantAction(
              'ops-summary-chats',
              'Show unread chats',
              this.getChatHref(user),
              'Open unread chats.',
            ),
          );
        }
        break;
    }

    if (
      intent === 'pending_tasks' &&
      report.counts.overduePayments > 0 &&
      topPayment?.paymentId
    ) {
      actions.push(
        createNavigateAssistantAction(
          'ops-pending-payments',
          'Show overdue payments',
          this.getPaymentsHref(user, topPayment.leadId ?? null, topPayment.projectId ?? null),
          'Open overdue payments.',
        ),
      );
    }

    if (!actions.length) {
      if (user.role === Role.ADMIN) {
        actions.push(
          createNavigateAssistantAction(
            'ops-fallback-bookings',
            'Show upcoming bookings',
            '/admin/bookings',
            'Open the booking workspace.',
          ),
          createNavigateAssistantAction(
            'ops-fallback-projects',
            'Open projects',
            '/admin/projects',
            'Review active projects.',
          ),
          createNavigateAssistantAction(
            'ops-fallback-chat',
            'Show unread chats',
            this.getChatHref(user),
            'Open the chat workspace.',
          ),
        );
      } else if (user.role === Role.CLIENT) {
        actions.push(
          createNavigateAssistantAction(
            'ops-fallback-bookings',
            'Show bookings',
            '/dashboard/bookings',
            'Open your booking workspace.',
          ),
          createNavigateAssistantAction(
            'ops-fallback-chat',
            'Show unread chats',
            this.getChatHref(user),
            'Open the chat workspace.',
          ),
        );
      } else if (user.role === Role.VENDOR) {
        actions.push(
          createNavigateAssistantAction(
            'ops-fallback-projects',
            'Open assignments',
            '/vendor',
            'Review your assignment queue.',
          ),
          createNavigateAssistantAction(
            'ops-fallback-chat',
            'Show unread chats',
            this.getChatHref(user),
            'Open the chat workspace.',
          ),
        );
      } else {
        actions.push(
          createNavigateAssistantAction(
            'ops-fallback-tasks',
            'Show pending tasks',
            this.getTasksHref(user),
            'Open the task workspace.',
          ),
          createNavigateAssistantAction(
            'ops-fallback-chat',
            'Show unread chats',
            this.getChatHref(user),
            'Open the chat workspace.',
          ),
        );
      }
    }

    return actions;
  }

  private getOperationalBucket(
    intent: AssistantIntent,
    report: AssistantOperationalSummary,
  ): AssistantOperationalBucket {
    switch (intent) {
      case 'pending_tasks':
        return report.pendingTasks;
      case 'overdue_items':
        return report.overdueItems;
      case 'upcoming_bookings':
        return report.upcomingBookings;
      case 'blocked_bookings':
        return report.blockedBookings;
      case 'stalled_projects':
        return report.stalledProjects;
      case 'unread_items':
        return {
          count: report.unread.threads.count + report.unread.notifications.count,
          totalSeverity:
            report.unread.threads.totalSeverity + report.unread.notifications.totalSeverity,
          items: [...report.unread.threads.items, ...report.unread.notifications.items],
        };
      case 'missing_assignments':
        return report.missingAssignments;
      case 'pending_approvals':
        return report.pendingApprovals;
      case 'overdue_payments':
        return report.overduePayments;
      case 'unsigned_contracts':
        return report.unsignedContracts;
      case 'operational_summary':
      default:
        return {
          count: report.topIssues.length,
          totalSeverity: this.sumOperationalSeverity(report.topIssues),
          items: report.topIssues,
        };
    }
  }

  private getOperationalActionLabels(
    intent: AssistantIntent,
    report: AssistantOperationalSummary,
    user: AuthUser,
  ) {
    switch (intent) {
      case 'pending_tasks':
        return ['Show pending tasks', 'Show stalled projects', 'Show overdue payments'];
      case 'overdue_items':
        return ['Show overdue payments', 'Show overdue tasks', 'Show unsigned contracts'];
      case 'upcoming_bookings':
        return ['Show upcoming bookings', 'Show blocked bookings', 'Show unread chats'];
      case 'blocked_bookings':
        return ['Show blocked bookings', 'Show pending tasks', 'Show unsigned contracts'];
      case 'stalled_projects':
        return ['Show stalled projects', 'Show pending tasks', 'Show unread chats'];
      case 'unread_items':
        return ['Show unread chats', 'Show alerts', 'Draft reply'];
      case 'missing_assignments':
        return ['Show unassigned bookings', 'Show pending tasks', 'Show blocked bookings'];
      case 'pending_approvals':
        return ['Show unsigned contracts', 'Draft follow-up', 'Show upcoming bookings'];
      case 'overdue_payments':
        return ['Show overdue payments', 'Draft reminder', 'Show unsigned contracts'];
      case 'unsigned_contracts':
        return ['Show unsigned contracts', 'Draft follow-up', 'Show upcoming bookings'];
      case 'operational_summary':
      default:
        const labels = [
          report.counts.overduePayments ? 'Show overdue payments' : null,
          report.counts.unsignedContracts ? 'Show unsigned contracts' : null,
          report.counts.blockedBookings ? 'Show blocked bookings' : null,
          report.unread.threads.count ? 'Show unread chats' : null,
        ].filter(Boolean) as string[];

        if (labels.length) {
          return labels;
        }

        if (user.role === Role.ADMIN) {
          return ['Show upcoming bookings', 'Open projects', 'Show unread chats'];
        }

        if (user.role === Role.CLIENT) {
          return ['Show bookings', 'Show unread chats', 'Open payments'];
        }

        if (user.role === Role.VENDOR) {
          return ['Open assignments', 'Show unread chats', 'Open projects'];
        }

        return ['Show pending tasks', 'Show unread chats', 'Open projects'];
    }
  }

  private formatOperationalRecord(record: AssistantOperationalRecord) {
    const parts = [record.title];
    if (record.subtitle) {
      parts.push(record.subtitle);
    }
    if (record.reason && record.reason !== record.title) {
      parts.push(record.reason);
    }

    return parts.join(' — ');
  }

  private sumOperationalSeverity(records: AssistantOperationalRecord[]) {
    return records.reduce((sum, record) => sum + record.severity, 0);
  }

  private buildPageOverviewReply(
    user: AuthUser,
    context: AssistantContextInput,
    pageKey: string,
    lead: any | null,
    project: any | null,
  ): AssistantTurn {
    const section = this.getContextSection(context);
    const effectiveLead = lead ?? project?.contract?.proposal?.lead ?? null;
    const effectiveProject =
      project ?? lead?.proposals?.[0]?.contract?.project ?? null;

    if (effectiveLead || effectiveProject) {
      const leadLine = effectiveLead
        ? `Booking: ${effectiveLead.eventType} on ${this.formatDate(
            effectiveLead.eventDate,
          )}`
        : 'This page is tied to an active booking or project';
      const statusLine = effectiveProject
        ? `Project status is ${effectiveProject.status} at ${effectiveProject.progress}% progress`
        : 'You can review the brief, proposal, payments, and next actions from here';

      return {
        content: buildAssistantResponseContent({
          style: 'direct_answer',
          summary: 'This page is already tied to a live booking or project record.',
          details: [[leadLine, statusLine].filter(Boolean).join(' | ')],
        }),
        actions: this.buildEntityActions(
          user,
          effectiveLead,
          effectiveProject,
          {
            includePayments: section === 'payments',
          },
        ),
      };
    }

    const contentBySection: Record<string, string> = {
      bookings: 'I can help review booking status, blockers, and the next move.',
      payments: 'I can help track pending payments, overdue items, and follow-up.',
      contracts: 'I can help review draft, sent, and signature stages.',
      chat: 'I can help with unread threads, replies, and the latest client conversation.',
      notifications: 'I can help sort fresh alerts and the items that need movement.',
      projects: 'I can help review delivery status, ownership, and active blockers.',
    };

    return {
      content: buildAssistantResponseContent({
        style: 'direct_answer',
        summary:
          contentBySection[section] ??
          'I can help with the page you are on and keep the answer focused.',
        details: [
          pageKey === 'workspace-dashboard'
            ? 'Since you are on the dashboard, I can also show what needs attention.'
            : `I am using the current ${section} context so I do not drift into the wrong record.`,
        ],
      }),
      actions: this.buildPromptChipActions(
        'page-overview',
        this.buildPageOverviewChipLabels(user, section),
      ),
      metadata: {
        responseType: 'page_overview',
      },
    };
  }

  private buildCreateBookingReply(
    user: AuthUser,
    context: AssistantContextInput,
    input: string,
  ): AssistantTurn {
    if (user.role === Role.VENDOR) {
      return {
        content:
          "I can't create bookings from the vendor workspace. I can help you review assignments, schedules, and payment status instead.",
        actions: [],
      };
    }

    const serviceSlug = this.resolveRequestedServiceSlug(input, context);
    const bookingHref = this.getCreateBookingHref(user, serviceSlug);
    const serviceLabel = this.getServiceLabel(serviceSlug);

    if (serviceLabel) {
      return {
        content: `Sure. I can help you start a ${serviceLabel.toLowerCase()} booking. First, what date, venue, and guest count should I plan around?`,
        actions: [
          {
            id: 'create-booking',
            type: 'NAVIGATE',
            label: 'Continue booking',
            href: bookingHref,
            description:
              'Open the right booking flow with this service in context.',
          },
        ],
      };
    }

    if (this.looksLikeBookingDetail(input)) {
      return {
        content:
          "Perfect. That sounds like enough to begin. Open the booking flow and I'll help you shape the details from there.",
        actions: [
          {
            id: 'create-booking',
            type: 'NAVIGATE',
            label: 'Continue booking',
            href: bookingHref,
            description: 'Open the correct booking entry flow for this role.',
          },
        ],
      };
    }

    return {
      content:
        user.role === Role.CLIENT
          ? 'Sure. I can help you start a booking. First, what type of event are you planning?'
          : "I'll route you to the booking workspace so you can open a new booking cleanly.",
      actions: [
        {
          id: 'create-booking',
          type: 'NAVIGATE',
          label: user.role === Role.CLIENT ? 'Start booking' : 'Create booking',
          href: bookingHref,
          description: 'Open the correct booking entry flow for this role.',
        },
      ],
    };
  }

  private buildBookingConsultationReply(
    user: AuthUser,
    context: AssistantContextInput,
    memory: AssistantBookingInsight,
    classification: AssistantClassification,
    message: string,
  ): AssistantTurn | null {
    const shouldHandle =
      classification.matchedIntents.includes('booking_inquiry') ||
      classification.matchedIntents.includes('booking_follow_up') ||
      classification.matchedIntents.includes('service_recommendation') ||
      classification.matchedIntents.includes('budget_discussion');

    if (!shouldHandle) {
      return null;
    }

    const hasConcreteDetails = Boolean(
      memory.guestCount ||
      memory.budgetAmount ||
      memory.city ||
      memory.location ||
      memory.venueType ||
      memory.indoorOutdoor ||
      memory.foodRequirement ||
      memory.drinkRequirement,
    );
    const hasStrongBrief = Boolean(
      hasConcreteDetails &&
        (memory.serviceSlug || memory.occasion || memory.eventType),
    );
    const hasAdjustmentOnly = Boolean(
      memory.budgetPreference ||
      memory.drinkRequirement ||
      memory.indoorOutdoor ||
      memory.city ||
      memory.location ||
      memory.foodRequirement,
    );
    const normalizedMessage = message.toLowerCase();
    const wantsCheaper = /\b(cheaper|lower|budget|leaner)\b/.test(
      normalizedMessage,
    );
    const wantsPremium = /\bpremium\b/.test(normalizedMessage);
    const wantsDry = /\bdry\b/.test(normalizedMessage);
    const wantsIndoor = /\bindoor\b/.test(normalizedMessage);
    const wantsOutdoor = /\boutdoor\b/.test(normalizedMessage);
    const wantsSnacks = /\bsnacks?\b/.test(normalizedMessage);
    const isFollowUpTurn =
      (memory.meaningfulTurns ?? 0) > 0 &&
      (detectFollowUpSignal(normalizedMessage) ||
        detectRepairSignal(normalizedMessage) ||
        classification.matchedIntents.includes('booking_follow_up') ||
        classification.matchedIntents.includes('budget_discussion'));

    if (
      classification.matchedIntents.includes('budget_discussion') &&
      memory.serviceSlug &&
      !memory.budgetAmount &&
      !memory.budgetPreference
    ) {
      const serviceLabel = this.getServiceLabel(memory.serviceSlug) ?? 'this setup';

      return {
        content: buildStructuredReply({
          summary: `Pricing for ${serviceLabel.toLowerCase()} depends on guest count, drinks, snacks, decor, and whether you want a lean or premium setup.`,
          details: [
            `Closest fit: ${serviceLabel}`,
            memory.likelyInclusions.length
              ? `Likely inclusions: ${memory.likelyInclusions.join(', ')}`
              : null,
            memory.city ? `City: ${memory.city}` : null,
            memory.location && memory.location !== memory.city
              ? `Location: ${memory.location}`
              : null,
            memory.indoorOutdoor
              ? `Venue direction: ${memory.indoorOutdoor}`
              : null,
            memory.drinkRequirement
              ? `Drink setup: ${memory.drinkRequirement === 'dry' ? 'dry' : 'alcoholic'}`
              : null,
            memory.foodRequirement ? `Food: ${memory.foodRequirement}` : null,
          ],
          nextActions: [
            'Share guest count',
            'Share budget',
            memory.drinkRequirement === 'dry' ? 'Keep it dry' : 'Make it dry',
            'Add snacks',
          ],
        }),
        actions: this.buildBookingConsultationActions(
          user,
          context,
          memory,
          message,
        ),
        metadata: {
          responseType: 'booking_refinement',
          classification,
          bookingMemory: memory,
          serviceRecommendation: memory.serviceSlug ?? null,
        },
      };
    }

    if (!hasStrongBrief && !hasAdjustmentOnly) {
      if (
        classification.matchedIntents.includes('service_recommendation') ||
        this.isServiceRecommendationIntent(normalizedMessage)
      ) {
        return this.buildServiceRecommendationReply(
          user,
          context,
          memory,
          classification,
          message,
        );
      }

      return null;
    }

    if (!hasStrongBrief && hasAdjustmentOnly) {
      const summary = wantsCheaper
        ? 'I can keep the same booking and make it cheaper.'
        : wantsPremium
          ? 'I can keep the same booking and make it more premium.'
          : wantsDry
            ? 'I can keep the same booking dry.'
            : wantsIndoor
              ? 'I can keep the same booking indoors.'
              : wantsOutdoor
                ? 'I can move the same booking outdoors.'
                : wantsSnacks
                  ? 'I can keep the same booking and add snacks.'
                  : memory.budgetPreference === 'lower'
                    ? 'I can keep the same booking and make it cheaper.'
                    : memory.budgetPreference === 'premium'
                      ? 'I can keep the same booking and make it more premium.'
                      : memory.drinkRequirement === 'dry'
                        ? 'I can keep the same booking dry.'
                        : memory.indoorOutdoor === 'indoor'
                          ? 'I can keep the same booking indoors.'
                          : memory.indoorOutdoor === 'outdoor'
                            ? 'I can move the same booking outdoors.'
                            : memory.foodRequirement === 'snacks'
                              ? 'I can keep the same booking and add snacks.'
                              : memory.city
                                ? `I can keep the same booking in ${memory.city}.`
                                : memory.foodRequirement
                                  ? `I can keep the same booking and add ${memory.foodRequirement}.`
                                  : 'I want to tighten the right booking.';

      return {
        content: buildAssistantResponseContent({
          style: 'follow_up',
          summary,
          details: [
            wantsCheaper
              ? 'I will keep the same context and look for a leaner option.'
              : wantsPremium
                ? 'I will keep the same context and look for a more premium option.'
                : wantsDry
                  ? 'I will keep the rest of the brief aligned and leave alcohol out.'
                  : wantsIndoor
                    ? 'I will keep the rest of the brief aligned and stay indoors.'
                    : wantsOutdoor
                      ? 'I will keep the rest of the brief aligned and move outdoors.'
                      : wantsSnacks
                        ? 'I will keep the same context and include snacks.'
                        : memory.budgetPreference === 'lower'
                          ? 'I will keep the same context and look for a leaner option.'
                          : memory.budgetPreference === 'premium'
                            ? 'I will keep the same context and look for a more premium option.'
                            : memory.drinkRequirement === 'dry'
                              ? 'I will keep the rest of the brief aligned and leave alcohol out.'
                              : memory.indoorOutdoor === 'indoor'
                                ? 'I will keep the rest of the brief aligned and stay indoors.'
                                : memory.indoorOutdoor === 'outdoor'
                                  ? 'I will keep the rest of the brief aligned and move outdoors.'
                                  : memory.foodRequirement === 'snacks'
                                    ? 'I will keep the same context and include snacks.'
                                    : memory.city
                                      ? 'I will keep the rest of the brief aligned around that city.'
                                      : memory.foodRequirement
                                        ? 'I will keep the rest of the brief aligned and include that food preference.'
                                        : 'I will keep the same context and tighten the brief.',
          ],
        }),
        actions: this.buildBookingConsultationActions(
          user,
          context,
          memory,
          message,
        ),
        metadata: {
          responseType: 'booking_refinement',
          classification,
          bookingMemory: memory,
          serviceRecommendation: memory.serviceSlug ?? null,
        },
      };
    }

    if (isFollowUpTurn && hasAdjustmentOnly) {
      const summary = wantsCheaper
        ? 'I can keep the same booking and make it cheaper.'
        : wantsPremium
          ? 'I can keep the same booking and make it more premium.'
          : wantsDry
            ? 'I can keep the same booking dry.'
            : wantsIndoor
              ? 'I can keep the same booking indoors.'
              : wantsOutdoor
                ? 'I can move the same booking outdoors.'
                : wantsSnacks
                  ? 'I can keep the same booking and add snacks.'
                  : memory.budgetPreference === 'lower'
                    ? 'I can keep the same booking and make it cheaper.'
                    : memory.budgetPreference === 'premium'
                      ? 'I can keep the same booking and make it more premium.'
                      : memory.drinkRequirement === 'dry'
                        ? 'I can keep the same booking dry.'
                        : memory.indoorOutdoor === 'indoor'
                          ? 'I can keep the same booking indoors.'
                          : memory.indoorOutdoor === 'outdoor'
                            ? 'I can move the same booking outdoors.'
                            : memory.foodRequirement === 'snacks'
                              ? 'I can keep the same booking and add snacks.'
                              : memory.city
                                ? `I can keep the same booking in ${memory.city}.`
                                : memory.foodRequirement
                                  ? `I can keep the same booking and add ${memory.foodRequirement}.`
                                  : 'I want to tighten the right booking.';

      return {
        content: buildAssistantResponseContent({
          style: 'follow_up',
          summary,
          details: [
            wantsCheaper
              ? 'I will keep the same context and look for a leaner option.'
              : wantsPremium
                ? 'I will keep the same context and look for a more premium option.'
                : wantsDry
                  ? 'I will keep the rest of the brief aligned and leave alcohol out.'
                  : wantsIndoor
                    ? 'I will keep the rest of the brief aligned and stay indoors.'
                    : wantsOutdoor
                      ? 'I will keep the rest of the brief aligned and move outdoors.'
                      : wantsSnacks
                        ? 'I will keep the same context and include snacks.'
                        : memory.budgetPreference === 'lower'
                          ? 'I will keep the same context and look for a leaner option.'
                          : memory.budgetPreference === 'premium'
                            ? 'I will keep the same context and look for a more premium option.'
                            : memory.drinkRequirement === 'dry'
                              ? 'I will keep the rest of the brief aligned and leave alcohol out.'
                              : memory.indoorOutdoor === 'indoor'
                                ? 'I will keep the rest of the brief aligned and stay indoors.'
                                : memory.indoorOutdoor === 'outdoor'
                                  ? 'I will keep the rest of the brief aligned and move outdoors.'
                                  : memory.foodRequirement === 'snacks'
                                    ? 'I will keep the same context and include snacks.'
                                    : memory.city
                                      ? 'I will keep the rest of the brief aligned around that city.'
                                      : memory.foodRequirement
                                        ? 'I will keep the rest of the brief aligned and include that food preference.'
                                        : 'I will keep the same context and tighten the brief.',
          ],
        }),
        actions: this.buildBookingConsultationActions(
          user,
          context,
          memory,
          message,
        ),
        metadata: {
          responseType: 'booking_refinement',
          classification,
          bookingMemory: memory,
          serviceRecommendation: memory.serviceSlug ?? null,
        },
      };
    }

    const serviceLabel =
      this.getServiceLabel(memory.serviceSlug)?.replace(/\b\w/g, (character) =>
        character.toUpperCase(),
      ) ?? 'Service fit still needs confirming';
    const budgetFit = this.describeBudgetFit(memory);
    const content = buildBookingConversationContent({
      serviceLabel,
      budgetFit,
      likelyInclusions: memory.likelyInclusions,
      missingDetails: memory.missingDetails,
      memory: {
        occasion: memory.occasion,
        eventType: memory.eventType,
        guestCount: memory.guestCount,
        budgetText: memory.budgetText,
        budgetPreference: memory.budgetPreference,
        city: memory.city,
        location: memory.location,
        venueType: memory.venueType,
        foodRequirement: memory.foodRequirement,
        drinkRequirement: memory.drinkRequirement,
        indoorOutdoor: memory.indoorOutdoor,
      },
      entities: {},
    });

    return {
      content,
      actions: this.buildBookingConsultationActions(
        user,
        context,
        memory,
        message,
      ),
      metadata: {
        responseType: 'booking_consultation',
        classification,
        bookingMemory: memory,
        serviceRecommendation: memory.serviceSlug ?? null,
      },
    };
  }

  private buildBookingConsultationActions(
    user: AuthUser,
    context: AssistantContextInput,
    memory: AssistantBookingInsight,
    message: string,
  ): AssistantAction[] {
    const normalizedMessage = message.toLowerCase();
    const wantsCheaper = /\b(cheaper|lower|budget|leaner)\b/.test(
      normalizedMessage,
    );
    const wantsPremium = /\bpremium\b/.test(normalizedMessage);
    const wantsDry = /\bdry\b/.test(normalizedMessage);
    const wantsIndoor = /\bindoor\b/.test(normalizedMessage);
    const wantsOutdoor = /\boutdoor\b/.test(normalizedMessage);
    const wantsSnacks = /\bsnacks?\b/.test(normalizedMessage);
    const serviceSlug =
      memory.serviceSlug ?? this.resolveRequestedServiceSlug('', context);
    const serviceLabel = this.getServiceLabel(serviceSlug) ?? 'booking';
    const guestsPrompt = memory.guestCount
      ? `${memory.guestCount} guests`
      : 'my guest count';
    const budgetPrompt = memory.budgetText ?? 'my budget';
    const actions: AssistantAction[] = [
      createNavigateAssistantAction(
        'consultation-start-booking',
        user.role === Role.CLIENT ? `Start ${serviceLabel}` : 'Create booking',
        this.getCreateBookingHref(user, serviceSlug),
        'Move straight into the booking flow.',
      ),
      createDraftAssistantAction(
        'consultation-estimate',
        wantsPremium
          ? 'Estimate premium package'
          : wantsCheaper
            ? 'Estimate cheaper package'
            : memory.budgetPreference === 'lower'
          ? 'Estimate cheaper package'
            : memory.budgetPreference === 'premium'
              ? 'Estimate premium package'
              : 'Estimate budget',
        `Estimate the best ${serviceLabel} setup for ${guestsPrompt} around ${budgetPrompt}.`,
        'Draft a tighter budget estimation request.',
      ),
      createDraftAssistantAction(
        'consultation-compare',
        'Compare package levels',
        'Compare the best service options and package levels for this event.',
        'Compare the most relevant service options.',
      ),
      createDraftAssistantAction(
        'consultation-team',
        'Draft team brief',
        'Draft a message to the team with my event brief and next questions.',
        'Draft the message to hand this brief to the team.',
      ),
    ];

    if (wantsCheaper || memory.budgetPreference === 'lower') {
      actions.push(
        createDraftAssistantAction(
          'consultation-budget-lower',
          'Make it cheaper',
          'Reduce the setup cost while keeping the booking workable.',
          'Draft a leaner version of the brief.',
        ),
      );
    }

    if (wantsPremium || memory.budgetPreference === 'premium') {
      actions.push(
        createDraftAssistantAction(
          'consultation-budget-premium',
          'Make it premium',
          'Shape the brief into a more premium setup.',
          'Draft a premium version of the brief.',
        ),
      );
    }

    if (wantsDry || memory.drinkRequirement === 'dry') {
      actions.push(
        createDraftAssistantAction(
          'consultation-dry',
          'Keep it dry',
          'Keep the event dry while shaping the rest of the brief.',
          'Draft a dry event version of the brief.',
        ),
      );
    }

    if (wantsIndoor || memory.indoorOutdoor === 'indoor') {
      actions.push(
        createDraftAssistantAction(
          'consultation-indoor',
          'Keep indoor setup',
          'Keep the event indoors while preserving the rest of the brief.',
          'Draft an indoor version of the brief.',
        ),
      );
    }

    if (wantsOutdoor || memory.indoorOutdoor === 'outdoor') {
      actions.push(
        createDraftAssistantAction(
          'consultation-outdoor',
          'Move outdoors',
          'Move the event outdoors while preserving the rest of the brief.',
          'Draft an outdoor version of the brief.',
        ),
      );
    }

    if (wantsSnacks || memory.foodRequirement === 'snacks') {
      actions.push(
        createDraftAssistantAction(
          'consultation-snacks',
          'Add snacks',
          'Include snacks in the plan while keeping the rest of the setup consistent.',
          'Draft a version with snacks included.',
        ),
      );
    }

    return dedupeAssistantActions(actions);
  }

  private async buildNextStepReply(
    user: AuthUser,
    lead: any | null,
    project: any | null,
    pageKey: string,
    context: AssistantContextInput,
  ): Promise<AssistantTurn> {
    const section = this.getContextSection(context);
    const effectiveLead = lead ?? project?.contract?.proposal?.lead ?? null;
    const effectiveProject =
      project ?? lead?.proposals?.[0]?.contract?.project ?? null;
    const contract =
      effectiveLead?.proposals?.[0]?.contract ??
      effectiveProject?.contract ??
      null;
    const pendingPayment = effectiveProject?.payments?.find((payment: any) =>
      [PaymentStatus.PENDING, PaymentStatus.FAILED].includes(payment.status),
    );
    const openTasks = this.getVisibleOpenTasks(user, effectiveProject);

    if (section === 'payments' && pendingPayment) {
      return {
        content:
          user.role === Role.CLIENT
            ? 'Next, complete the pending milestone payment.'
            : `Next, move the ${pendingPayment.type.toLowerCase()} payment of ${this.formatCurrency(
                pendingPayment.amount,
              )}.`,
        actions: this.buildEntityActions(
          user,
          effectiveLead,
          effectiveProject,
          {
            includePayments: true,
          },
        ),
        metadata: {
          responseType: 'next_step_help',
          pageKey,
          section,
        },
      };
    }

    if (section === 'contracts') {
      if (contract?.status === ContractStatus.SENT) {
        return {
          content:
            user.role === Role.CLIENT
              ? 'Next, review and sign the agreement.'
              : 'Next, get the agreement signed so the booking can keep moving.',
          actions: this.buildEntityActions(
            user,
            effectiveLead,
            effectiveProject,
          ),
          metadata: {
            responseType: 'next_step_help',
            pageKey,
            section,
          },
        };
      }

      if (contract?.status === ContractStatus.DRAFT) {
        return {
          content:
            user.role === Role.CLIENT
              ? 'Next, wait for the agreement to be sent across for signature.'
              : 'Next, send the agreement for signature.',
          actions: this.buildEntityActions(
            user,
            effectiveLead,
            effectiveProject,
          ),
          metadata: {
            responseType: 'next_step_help',
            pageKey,
            section,
          },
        };
      }
    }

    if (section === 'chat' || section === 'notifications') {
      return {
        content: 'Next, review unread messages and pending actions.',
        actions: [
          {
            id: 'open-chat',
            type: 'NAVIGATE',
            label: 'Open chat',
            href: this.getChatHref(user),
            description: 'Jump into the active messaging workspace.',
          },
        ],
        metadata: {
          responseType: 'next_step_help',
          pageKey,
          section,
        },
      };
    }

    if (effectiveProject && openTasks.length) {
      return {
        content: `Next, move the open execution work, starting with "${openTasks[0].title}".`,
        actions: this.buildEntityActions(user, effectiveLead, effectiveProject),
        metadata: {
          responseType: 'next_step_help',
          pageKey,
          section,
        },
      };
    }

    if (effectiveLead || effectiveProject) {
      return this.buildPendingReply(user, lead, project, pageKey, context);
    }

    if (section === 'bookings' || section === 'projects') {
      return {
        content:
          'Next, open the booking or project you want help with and I can tell you exactly what needs movement.',
        actions: [],
        metadata: {
          responseType: 'next_step_help',
          pageKey,
          section,
        },
      };
    }

    if (user.role === Role.CLIENT) {
      return {
        content:
          'Next, review unread messages and any pending payment or contract step on your active booking.',
        actions: [],
        metadata: {
          responseType: 'next_step_help',
          pageKey,
          section,
        },
      };
    }

    return {
      content:
        'Next, review unread messages and the bookings with the most immediate blockers.',
      actions: [],
      metadata: {
        responseType: 'next_step_help',
        pageKey,
        section,
      },
    };
  }

  private buildAfterSubmitReply(
    user: AuthUser,
    context: AssistantContextInput,
    lead: any | null,
    project: any | null,
  ): AssistantTurn {
    const section = this.getContextSection(context);
    const actions = this.buildEntityActions(
      user,
      lead ?? project?.contract?.proposal?.lead ?? null,
      project ?? lead?.proposals?.[0]?.contract?.project ?? null,
      {
        includePayments: section === 'payments',
      },
    );

    if (user.role === Role.CLIENT) {
      return {
        content:
          'After submission, the admin team reviews your request, creates the proposal, assigns the team if needed, and then shares the payment or contract steps.',
        actions,
      };
    }

    return {
      content:
        'After submission, the booking moves through review, proposal prep, contract or payment handling, and then into staffing and execution.',
      actions,
    };
  }

  private buildSupportReply(
    user: AuthUser,
    context: AssistantContextInput,
  ): AssistantTurn {
    return this.buildEscalationReply(
      user,
      context,
      null,
      null,
      '',
      null,
      null,
      '',
    );
  }

  private buildUnsupportedReply(
    user: AuthUser,
    context: AssistantContextInput,
    message: string,
    classification?: AssistantClassification | null,
    memory?: AssistantConversationMemory | null,
    pageKey?: string,
  ): AssistantTurn {
    const normalizedMessage = message.trim();
    const explicitUnsupported = detectUnsupportedRequest(normalizedMessage);
    const summary = explicitUnsupported
      ? "I can't help with that request, but I can help with a private celebration instead."
      : "I can't tell which supported event you mean yet.";

    return {
      content: buildAssistantResponseContent({
        style: 'unsupported_request',
        summary,
        details: [
          explicitUnsupported
            ? 'I can help you rewrite it into a private celebration, anniversary, or intimate gathering brief instead.'
            : 'I do not want to guess the wrong event category.',
        ],
      }),
      actions: dedupeAssistantActions([
        createDraftAssistantAction(
          'unsupported-brief',
          'Rewrite request',
          'Help me turn this into a supported event brief.',
          'Rewrite the request into a supported event format.',
        ),
        createDraftAssistantAction(
          'unsupported-team',
          'Show supported event types',
          'Show me the supported event types.',
          'List the event types Beer can help with.',
        ),
        createNavigateAssistantAction(
          'unsupported-contact',
          user.role === Role.ADMIN ? 'Open chat' : 'Contact team',
          this.getChatHref(user),
          'Open a human handoff path.',
        ),
      ]),
      metadata: {
        responseType: 'unsupported_request',
        confidence: classification?.confidence ?? null,
        pageKey: pageKey ?? null,
        matchedIntents: classification?.matchedIntents ?? [],
        unsupported: true,
        unsupportedReason: explicitUnsupported
          ? 'explicit_or_out_of_scope'
          : 'unclear_format',
      },
    };
  }

  private buildEscalationReply(
    user: AuthUser,
    context: AssistantContextInput,
    lead: any | null,
    project: any | null,
    message: string,
    classification?: AssistantClassification | null,
    memory?: AssistantConversationMemory | null,
    pageKey?: string,
  ): AssistantTurn {
    const normalizedMessage = message.trim();
    const lowConfidence = classification
      ? this.isLowConfidenceClassification(classification)
      : true;
    const repeatedFallback = (memory?.fallbackCount ?? 0) >= 1;
    const frustration = this.isFrustrationText(normalizedMessage);
    const unsupported = this.isUnsupportedActionText(normalizedMessage);
    const subjectContext =
      lead?.eventType ??
      project?.summary ??
      context.pageTitle ??
      pageKey ??
      'this request';
    const subject = `Need help with ${subjectContext}`;
    const shortVersion = normalizedMessage
      ? `Hi team, I need a quick hand with ${normalizedMessage}.`
      : 'Hi team, I need a quick hand with the current request.';
    const detailedVersion = [
      `Subject: ${subject}`,
      shortVersion,
      `Context: ${context.pageTitle ?? context.pagePath ?? 'current workspace'}.`,
      lead ? `Booking: ${lead.eventType} at ${lead.location ?? 'TBD'}.` : null,
      project ? `Project: ${project.status} at ${project.progress}% progress.` : null,
      repeatedFallback ? 'The same fallback has already happened.' : null,
      lowConfidence ? 'The assistant is not confident enough to keep guessing.' : null,
      frustration ? 'The wording suggests frustration or urgency.' : null,
      unsupported ? 'The request looks unsupported from the current workspace.' : null,
    ]
      .filter(Boolean)
      .join('\n');

    const bookingAction = lead
      ? createNavigateAssistantAction(
          'escalate-open-booking',
          'Open booking',
          this.getLeadHref(user, lead.id),
          'Jump to the current booking.',
        )
      : project
        ? createNavigateAssistantAction(
            'escalate-open-booking',
            'Open booking',
            this.getProjectHref(user, project.id, lead?.id) ??
              this.getCreateBookingHref(user),
            'Jump to the current project or booking.',
          )
        : createNavigateAssistantAction(
            'escalate-open-bookings',
            user.role === Role.ADMIN ? 'Open bookings' : 'Open booking',
            user.role === Role.ADMIN
              ? '/admin/bookings'
              : this.getCreateBookingHref(
                  user,
                  this.resolveRequestedServiceSlug('', context),
                ),
            'Jump to the most relevant booking workspace.',
          );

    const contactLabel =
      user.role === Role.ADMIN ? 'Open chat' : 'Contact team';

    return {
      content: buildAssistantResponseContent({
        style: 'escalation',
        summary:
          lowConfidence || repeatedFallback || frustration || unsupported
            ? "I'm sorry, I don't want to keep guessing here. This needs a human handoff."
            : 'This one needs a human handoff.',
        details: [
          lowConfidence
            ? 'I am not confident enough to answer cleanly from the current context.'
            : null,
          repeatedFallback
            ? 'The same fallback has already happened, so it is better to escalate now.'
            : null,
          frustration
            ? 'The message reads as frustrated or urgent, so I am switching to a handoff.'
            : null,
          unsupported
            ? 'The request looks unsupported in this workspace and should be reviewed by the team.'
            : null,
        ],
      }),
      actions: dedupeAssistantActions([
        createDraftAssistantAction(
          'escalation-talk-team',
          'Send to team',
          detailedVersion,
          'Load a handoff note into the composer.',
        ),
        createCopyAssistantAction(
          'escalation-copy',
          'Copy note',
          detailedVersion,
          'Copy the handoff note for manual review.',
        ),
        bookingAction,
        createNavigateAssistantAction(
          'escalation-contact',
          contactLabel,
          this.getChatHref(user),
          'Open the team chat or admin workspace for escalation.',
        ),
      ]),
      metadata: {
        responseType: 'escalation',
        handoffSubject: subject,
        handoffShortVersion: shortVersion,
        handoffDetailedVersion: detailedVersion,
        lowConfidence,
        repeatedFallback,
        frustration,
        unsupported,
        pageKey: pageKey ?? null,
      },
    };
  }

  private async buildPendingReply(
    user: AuthUser,
    lead: any | null,
    project: any | null,
    pageKey: string,
    context?: AssistantContextInput,
  ): Promise<AssistantTurn> {
    if (!lead && !project) {
      return this.buildFallbackReply(user, pageKey, context);
    }

    const effectiveLead = lead ?? project?.contract?.proposal?.lead ?? null;
    const effectiveProject =
      project ?? lead?.proposals?.[0]?.contract?.project ?? null;
    const proposal =
      effectiveLead?.proposals?.[0] ??
      effectiveProject?.contract?.proposal ??
      null;
    const contract = proposal?.contract ?? null;
    const paymentBlockers =
      effectiveProject?.payments?.filter((payment: any) =>
        [PaymentStatus.PENDING, PaymentStatus.FAILED].includes(payment.status),
      ) ?? [];
    const openTasks = this.getVisibleOpenTasks(user, effectiveProject);
    const unreadMessages =
      user.role !== Role.VENDOR && effectiveLead
        ? await this.prisma.conversationThread
            .findMany({
              where: {
                leadId: effectiveLead.id,
                messages: {
                  some: {
                    senderId: {
                      not: user.userId,
                    },
                    readAt: null,
                  },
                },
              },
              include: {
                messages: {
                  where: {
                    senderId: {
                      not: user.userId,
                    },
                    readAt: null,
                  },
                  take: 10,
                },
              },
            })
            .then((threads) =>
              threads.reduce((sum, thread) => sum + thread.messages.length, 0),
            )
        : 0;
    const missingDocuments =
      effectiveProject && !effectiveProject.documents?.length ? 1 : 0;
    const lines: string[] = [];

    if (!proposal) {
      lines.push('Proposal still needs to be prepared or sent.');
    } else if (proposal.status === 'DRAFT') {
      lines.push('Proposal exists but is still sitting in draft.');
    } else if (proposal.status === 'SENT') {
      lines.push('Proposal is out with the client and waiting on a decision.');
    }

    if (proposal?.status === 'ACCEPTED' && !contract) {
      lines.push(
        'Proposal is accepted, but the contract has not been created yet.',
      );
    } else if (contract?.status === ContractStatus.DRAFT) {
      lines.push('Contract is drafted but not sent yet.');
    } else if (contract?.status === ContractStatus.SENT) {
      lines.push('Contract is sent and still waiting for signature.');
    }

    if (paymentBlockers.length) {
      const total = paymentBlockers.reduce(
        (sum: number, payment: any) => sum + payment.amount,
        0,
      );
      lines.push(
        `${paymentBlockers.length} payment blocker${paymentBlockers.length === 1 ? '' : 's'} remain, totaling ${this.formatCurrency(total)}.`,
      );
    }

    if (openTasks.length) {
      lines.push(
        `${openTasks.length} execution task${openTasks.length === 1 ? '' : 's'} are still open, including "${openTasks[0].title}".`,
      );
    }

    if (unreadMessages) {
      lines.push(
        `${unreadMessages} recent message update${unreadMessages === 1 ? '' : 's'} still need review on this booking.`,
      );
    }

    if (missingDocuments) {
      lines.push('Project documents are still missing from the record.');
    }

    if (!lines.length) {
      lines.push(
        'Nothing major is blocked from the data I can see. This one looks clean.',
      );
    }

    const section = context ? deriveAssistantSection(context) : 'general';
    const summary =
      section === 'payments' && paymentBlockers.length
        ? `${paymentBlockers.length} payment blocker${paymentBlockers.length === 1 ? '' : 's'} are the main thing holding this record up.`
        : section === 'contracts' && contract?.status === ContractStatus.SENT
          ? 'Signature is the main blocker on this booking right now.'
          : section === 'chat' && unreadMessages
            ? 'Unread messages are the first thing that needs attention here.'
            : `${lines.length} active blocker${lines.length === 1 ? '' : 's'} are still showing on this booking.`;

    return {
      content: buildStructuredReply({
        summary,
        details: lines,
        nextActions: [
          paymentBlockers.length ? 'View payments' : null,
          contract?.status === ContractStatus.SENT
            ? 'Review contract stage'
            : null,
          unreadMessages ? 'Open chat workspace' : null,
          openTasks.length ? 'View pending tasks' : null,
        ],
      }),
      actions: dedupeAssistantActions(
        [
          ...this.buildEntityActions(user, effectiveLead, effectiveProject, {
            includePayments: paymentBlockers.length > 0,
          }),
          unreadMessages
            ? createNavigateAssistantAction(
                'pending-open-chat',
                'Show unread chats',
                this.getChatHref(user),
                'Open the related chat workspace.',
              )
            : null,
        ].filter(Boolean) as AssistantAction[],
      ),
      metadata: {
        responseType: 'pending_summary',
        pageKey,
        leadId: effectiveLead?.id ?? null,
        projectId: effectiveProject?.id ?? null,
        paymentStatus: paymentBlockers.length ? 'PENDING' : null,
        contractStatus: contract?.status ?? null,
      },
    };
  }

  private buildSummaryReply(
    user: AuthUser,
    lead: any | null,
    project: any | null,
    context?: AssistantContextInput,
  ): AssistantTurn {
    const effectiveLead = lead ?? project?.contract?.proposal?.lead ?? null;
    const effectiveProject =
      project ?? lead?.proposals?.[0]?.contract?.project ?? null;

    if (!effectiveLead && !effectiveProject) {
      return {
        content: buildAssistantResponseContent({
          style: 'direct_answer',
          summary:
            'Open a booking or project page and I can turn it into a tight summary for you.',
        }),
        actions: [],
        metadata: {
          responseType: 'entity_summary',
        },
      };
    }

    const lines = [
      effectiveLead
        ? `${effectiveLead.eventType} at ${effectiveLead.location} on ${this.formatDate(effectiveLead.eventDate)}`
        : null,
      effectiveProject
        ? `Project status is ${effectiveProject.status} at ${effectiveProject.progress}% progress`
        : null,
      effectiveProject?.payments?.length
        ? `Payment coverage is ${this.formatCurrency(
            effectiveProject.payments
              .filter((payment: any) => payment.status === PaymentStatus.PAID)
              .reduce((sum: number, payment: any) => sum + payment.amount, 0),
          )} paid out of ${this.formatCurrency(
            effectiveProject.payments.reduce(
              (sum: number, payment: any) => sum + payment.amount,
              0,
            ),
          )}`
        : null,
      effectiveProject?.summary
        ? `Current summary: ${effectiveProject.summary}`
        : null,
      effectiveProject?.documents?.length
        ? `${effectiveProject.documents.length} document${effectiveProject.documents.length === 1 ? '' : 's'} are attached to the project`
        : null,
    ].filter(Boolean) as string[];

    return {
      content: buildStructuredReply({
        summary:
          typeof context?.metadata?.currentTab === 'string'
            ? `Here is the ${context.metadata.currentTab} summary for the current record.`
            : 'Here is the clean summary for the current record.',
        details: lines,
        nextActions: ['Show pending actions', 'Open booking', 'View payments'],
      }),
      actions: this.buildEntityActions(user, effectiveLead, effectiveProject),
      metadata: {
        responseType: 'entity_summary',
      },
    };
  }

  private buildAssignmentsReply(
    user: AuthUser,
    lead: any | null,
    project: any | null,
  ): AssistantTurn {
    const effectiveLead = lead ?? project?.contract?.proposal?.lead ?? null;
    const effectiveProject =
      project ?? lead?.proposals?.[0]?.contract?.project ?? null;
    const staffAssignments =
      effectiveProject?.assignments ?? effectiveLead?.assignments ?? [];
    const vendors = effectiveProject?.vendors ?? [];

    if (!staffAssignments.length && !vendors.length) {
      return {
        content: 'I am not seeing assignment data on this record yet.',
        actions: [],
        metadata: {
          responseType: 'entity_summary',
        },
      };
    }

    const staffLine = staffAssignments.length
      ? `- Internal: ${staffAssignments
          .map(
            (assignment: any) =>
              assignment.user?.name ?? assignment.user?.role ?? 'Team',
          )
          .join(', ')}.`
      : null;
    const vendorLine = vendors.length
      ? `- Vendors: ${vendors
          .map((assignment: any) => assignment.vendor?.name ?? 'Vendor')
          .join(', ')}.`
      : null;

    return {
      content: ['Here is the current ownership view:', staffLine, vendorLine]
        .filter(Boolean)
        .join('\n'),
      actions: this.buildEntityActions(user, effectiveLead, effectiveProject),
      metadata: {
        responseType: 'entity_summary',
      },
    };
  }

  private buildDraftReply(
    user: AuthUser,
    lead: any | null,
    project: any | null,
    context?: AssistantContextInput,
  ): AssistantTurn {
    const effectiveLead = lead ?? project?.contract?.proposal?.lead ?? null;
    const effectiveProject =
      project ?? lead?.proposals?.[0]?.contract?.project ?? null;
    const clientName =
      effectiveLead?.client?.name ??
      effectiveProjectClient(effectiveProject)?.name ??
      'there';
    const pendingPayments =
      project?.payments?.filter((payment: any) =>
        [PaymentStatus.PENDING, PaymentStatus.FAILED].includes(payment.status),
      ) ?? [];
    const pendingPayment = pendingPayments[0] ?? null;

    const currentTab =
      typeof context?.metadata?.currentTab === 'string'
        ? context.metadata.currentTab
        : null;
    const draftMode =
      typeof context?.metadata?.draftMode === 'string'
        ? context.metadata.draftMode
        : '';
    let subject = `Update on ${effectiveLead?.eventType ?? 'your booking'}`;
    let shortVersion = `Hi ${clientName}, quick note from The Indian Bar Company.`;
    let detailedVersion = `Hi ${clientName}, quick note from The Indian Bar Company. `;

    if (
      currentTab === 'timeline' ||
      currentTab === 'updates' ||
      /internal note/i.test(draftMode)
    ) {
      subject = `Internal note: ${effectiveLead?.eventType ?? 'Booking'} status`;
      shortVersion = `Internal note: ${effectiveLead?.eventType ?? 'Booking'} is in ${effectiveProject?.status ?? 'active review'} stage.`;
      detailedVersion = `Internal note: ${effectiveLead?.eventType ?? 'Booking'} is currently at ${effectiveProject?.status ?? 'active review'} stage. Next priority is ${pendingPayment ? `${pendingPayment.type.toLowerCase()} payment follow-up` : 'keeping execution on track'}.`;
    } else if (currentTab === 'contracts' && effectiveLead) {
      subject = `Contract update for ${effectiveLead.eventType}`;
      shortVersion = `Hi ${clientName}, the agreement for your ${effectiveLead.eventType.toLowerCase()} is in focus right now.`;
      detailedVersion += `The agreement for your ${effectiveLead.eventType.toLowerCase()} is the main item in focus right now. I wanted to share a neat status check-in and keep signature movement smooth from here.`;
    } else if (pendingPayment) {
      subject = `Payment follow-up for ${effectiveLead?.eventType ?? 'your booking'}`;
      shortVersion = `Hi ${clientName}, the ${pendingPayment.type.toLowerCase()} payment is still pending.`;
      detailedVersion += `We are nearly set on our side, and the next step is the ${pendingPayment.type.toLowerCase()} payment of ${this.formatCurrency(
        pendingPayment.amount,
      )}. Once that is cleared, we can keep the remaining event timeline crisp and fully locked.`;
    } else if (effectiveLead) {
      subject = `Booking update for ${effectiveLead.eventType}`;
      shortVersion = `Hi ${clientName}, we are aligned on the current brief for your ${effectiveLead.eventType.toLowerCase()}.`;
      detailedVersion += `We are aligned on the current brief for your ${effectiveLead.eventType.toLowerCase()}, and I wanted to share a neat status check-in. If you would like any refinements on the plan, I can help tighten those next.`;
    } else {
      subject = 'Workspace follow-up';
      shortVersion =
        'Hi there, the workspace is moving well and the next action is ready to tighten.';
      detailedVersion += `Everything on the workspace is moving well. If you'd like, I can help tighten the next action and keep the momentum smooth from here.`;
    }

    return {
      content: buildStructuredReply({
        summary: 'Draft prepared and ready for review.',
        details: [
          `Subject: ${subject}`,
          `Short version: ${shortVersion}`,
          `Detailed version: ${detailedVersion}`,
          'Use the copy actions to choose a version, edit it in the composer, and send it manually when ready.',
        ],
        nextActions: ['Copy subject', 'Copy short version', 'Edit draft'],
      }),
      actions: dedupeAssistantActions([
        createDraftAssistantAction(
          'apply-draft',
          'Edit draft',
          detailedVersion,
          'Load the detailed version into the assistant composer.',
        ),
        createCopyAssistantAction(
          'copy-draft-subject',
          'Copy subject',
          subject,
          'Copy the draft subject line.',
        ),
        createCopyAssistantAction(
          'copy-draft-short',
          'Copy short version',
          shortVersion,
          'Copy the shorter draft version.',
        ),
        createCopyAssistantAction(
          'copy-draft-detailed',
          'Copy detailed version',
          detailedVersion,
          'Copy the detailed draft version.',
        ),
        createNavigateAssistantAction(
          'send-draft-manually',
          'Send manually',
          this.getChatHref(user),
          'Open the chat workspace so you can send the message yourself.',
        ),
      ]),
      metadata: {
        responseType: 'draft_preview',
        draft: detailedVersion,
        draftSubject: subject,
        draftShortVersion: shortVersion,
        draftDetailedVersion: detailedVersion,
      },
    };
  }

  private buildPaymentReminderReply(
    user: AuthUser,
    lead: any | null,
    project: any | null,
    context?: AssistantContextInput,
  ): AssistantTurn {
    const effectiveLead = lead ?? project?.contract?.proposal?.lead ?? null;
    const effectiveProject =
      project ?? lead?.proposals?.[0]?.contract?.project ?? null;
    const payment = effectiveProject?.payments?.find((candidate: any) =>
      [PaymentStatus.PENDING, PaymentStatus.FAILED].includes(candidate.status),
    );

    if (!payment || !effectiveLead) {
      return {
        content: buildStructuredReply({
          summary:
            'I can draft a payment reminder once there is a pending payment on the booking in scope.',
          nextActions: ['Show pending payments', 'Open booking'],
        }),
        actions: [],
        metadata: {
          responseType: 'draft_preview',
        },
      };
    }

    const clientName = effectiveLead.client?.name ?? 'there';
    const subject = `Payment reminder for ${effectiveLead.eventType}`;
    const shortVersion = `Hi ${clientName}, a gentle reminder that the ${payment.type.toLowerCase()} milestone is still pending.`;
    const reminder = `Hi ${clientName}, a gentle nudge from The Indian Bar Company. The ${payment.type.toLowerCase()} milestone of ${this.formatCurrency(
      payment.amount,
    )}${payment.dueDate ? ` due on ${this.formatDate(payment.dueDate)}` : ''} is still pending for your ${effectiveLead.eventType.toLowerCase()}. Once that lands, we can keep the remaining execution pieces moving without any drag. Happy to resend the payment link if helpful.`;

    return {
      content: buildStructuredReply({
        summary: 'Payment reminder draft is ready for review.',
        details: [
          `Subject: ${subject}`,
          `Short version: ${shortVersion}`,
          `Detailed version: ${reminder}`,
          payment.dueDate
            ? `This reminder is tied to the ${payment.type.toLowerCase()} milestone due ${this.formatDate(payment.dueDate)}.`
            : `This reminder is tied to the ${payment.type.toLowerCase()} milestone.`,
          'Use the copy actions to choose a version, edit it in the composer, and send it manually when ready.',
        ],
        nextActions: ['Copy subject', 'Copy short version', 'Edit reminder'],
      }),
      actions: dedupeAssistantActions([
        createDraftAssistantAction(
          'apply-reminder',
          'Edit reminder',
          reminder,
          'Load the detailed reminder into the composer.',
        ),
        createCopyAssistantAction(
          'copy-reminder-subject',
          'Copy subject',
          subject,
          'Copy the reminder subject line.',
        ),
        createCopyAssistantAction(
          'copy-reminder-short',
          'Copy short version',
          shortVersion,
          'Copy the shorter reminder version.',
        ),
        createCopyAssistantAction(
          'copy-reminder-detailed',
          'Copy detailed version',
          reminder,
          'Copy the detailed reminder version.',
        ),
        createNavigateAssistantAction(
          'send-reminder-manually',
          'Send manually',
          this.getChatHref(user),
          'Open the chat workspace so you can send the reminder yourself.',
        ),
      ]),
      metadata: {
        responseType: 'draft_preview',
        draft: reminder,
        draftSubject: subject,
        draftShortVersion: shortVersion,
        draftDetailedVersion: reminder,
        paymentId: payment.id,
        currentTab:
          typeof context?.metadata?.currentTab === 'string'
            ? context.metadata.currentTab
            : null,
      },
    };
  }

  private buildNavigationReply(
    user: AuthUser,
    lead: any | null,
    project: any | null,
  ): AssistantTurn {
    const actions = this.buildEntityActions(
      user,
      lead ?? project?.contract?.proposal?.lead ?? null,
      project ?? lead?.proposals?.[0]?.contract?.project ?? null,
      {
        includePayments: true,
      },
    );

    if (!actions.length) {
      return {
        content:
          'I do not have a stronger workspace target from this thread yet. Ask me for the next event, latest proposal, or what is pending here.',
        actions: [],
        metadata: {
          responseType: 'next_step_help',
        },
      };
    }

    return {
      content: 'I pulled the most relevant workspace actions for you.',
      actions,
      metadata: {
        responseType: 'next_step_help',
      },
    };
  }

  private async buildWorkspaceSearchReply(
    user: AuthUser,
    context: AssistantContextInput,
    message: string,
    pageKey: string,
    debugTrace?: AssistantPipelineDebugTrace | null,
  ): Promise<AssistantTurn> {
    const normalizedMessage = message.trim();
    const searchTerms = this.extractWorkspaceSearchTerms(normalizedMessage);
    const categoryTerms = new Set([
      'booking',
      'bookings',
      'payment',
      'payments',
      'invoice',
      'invoices',
      'contract',
      'contracts',
      'agreement',
      'agreements',
      'project',
      'projects',
      'chat',
      'chats',
      'message',
      'messages',
      'notification',
      'notifications',
      'alert',
      'alerts',
      'client',
      'clients',
      'customer',
      'customers',
      'vendor',
      'vendors',
      'conversation',
      'conversations',
      'thread',
      'threads',
    ]);
    const statusTerms = new Set([
      'unpaid',
      'overdue',
      'pending',
      'failed',
      'refund',
      'refunded',
      'paid',
      'unsigned',
      'draft',
      'sent',
      'signed',
      'unread',
      'blocked',
      'stalled',
    ]);
    const specificSearchTerms = searchTerms.filter(
      (term) => !categoryTerms.has(term) && !statusTerms.has(term),
    );
    const priorMemory = this.toObjectRecord(
      context.metadata?.assistantMemory as Prisma.JsonValue,
    );
    const lowerMessage = normalizedMessage.toLowerCase();
    const priorSearchQuery =
      typeof priorMemory?.lastSearchQuery === 'string'
        ? priorMemory.lastSearchQuery.trim()
        : '';
    const followUpSearchSignal = this.includesAny(lowerMessage, [
      'same',
      'that',
      'those',
      'these',
      'another',
      'more',
      'again',
      'previous',
      'older',
    ]);
    const searchText =
      specificSearchTerms.join(' ').trim() ||
      (followUpSearchSignal ? priorSearchQuery : '');
    const hasSpecificText = searchText.length > 0;
    const hasBookingFocus = this.includesAny(lowerMessage, [
      'booking',
      'bookings',
      'event',
      'events',
      'lead',
      'leads',
      'request',
    ]);
    const hasPaymentFocus = this.includesAny(lowerMessage, [
      'payment',
      'payments',
      'invoice',
      'invoices',
      'milestone',
      'refund',
      'receipt',
      'overdue',
      'unpaid',
      'pending',
      'failed',
    ]);
    const hasContractFocus = this.includesAny(lowerMessage, [
      'contract',
      'contracts',
      'agreement',
      'agreements',
      'signature',
      'signed',
      'unsigned',
      'draft',
    ]);
    const hasProjectFocus = this.includesAny(lowerMessage, [
      'project',
      'projects',
      'task',
      'tasks',
      'timeline',
      'blocked',
      'stalled',
      'progress',
    ]);
    const hasChatFocus = this.includesAny(lowerMessage, [
      'chat',
      'chats',
      'message',
      'messages',
      'thread',
      'threads',
      'conversation',
      'inbox',
      'unread',
    ]);
    const hasUnreadFocus = this.includesAny(lowerMessage, ['unread']);
    const hasNotificationFocus = this.includesAny(lowerMessage, [
      'notification',
      'notifications',
      'alert',
      'alerts',
    ]);
    const hasClientFocus =
      user.role === Role.ADMIN &&
      this.includesAny(lowerMessage, [
        'client',
        'clients',
        'customer',
        'customers',
      ]);
    const hasVendorFocus =
      user.role === Role.ADMIN &&
      this.includesAny(lowerMessage, [
        'vendor',
        'vendors',
        'supplier',
        'suppliers',
      ]);
    const hasConversationFocus = this.includesAny(lowerMessage, [
      'conversation',
      'conversations',
      'history',
      'previous',
      'older',
      'last',
      'earlier',
    ]);
    const broadSearch =
      !hasBookingFocus &&
      !hasPaymentFocus &&
      !hasContractFocus &&
      !hasProjectFocus &&
      !hasChatFocus &&
      !hasNotificationFocus &&
      !hasClientFocus &&
      !hasVendorFocus &&
      !hasConversationFocus;
    const onlyBookingFocus =
      hasBookingFocus &&
      !hasPaymentFocus &&
      !hasContractFocus &&
      !hasProjectFocus &&
      !hasChatFocus &&
      !hasNotificationFocus &&
      !hasClientFocus &&
      !hasVendorFocus &&
      !hasConversationFocus;
    const onlyProjectFocus =
      hasProjectFocus &&
      !hasBookingFocus &&
      !hasPaymentFocus &&
      !hasContractFocus &&
      !hasChatFocus &&
      !hasNotificationFocus &&
      !hasClientFocus &&
      !hasVendorFocus &&
      !hasConversationFocus;
    const onlyChatFocus =
      hasChatFocus &&
      !hasBookingFocus &&
      !hasPaymentFocus &&
      !hasContractFocus &&
      !hasProjectFocus &&
      !hasNotificationFocus &&
      !hasClientFocus &&
      !hasVendorFocus &&
      !hasConversationFocus;
    const onlyConversationFocus =
      hasConversationFocus &&
      !hasBookingFocus &&
      !hasPaymentFocus &&
      !hasContractFocus &&
      !hasProjectFocus &&
      !hasChatFocus &&
      !hasNotificationFocus &&
      !hasClientFocus &&
      !hasVendorFocus;
    const onlyClientFocus =
      hasClientFocus &&
      !hasBookingFocus &&
      !hasPaymentFocus &&
      !hasContractFocus &&
      !hasProjectFocus &&
      !hasChatFocus &&
      !hasNotificationFocus &&
      !hasVendorFocus &&
      !hasConversationFocus;
    const onlyVendorFocus =
      hasVendorFocus &&
      !hasBookingFocus &&
      !hasPaymentFocus &&
      !hasContractFocus &&
      !hasProjectFocus &&
      !hasChatFocus &&
      !hasNotificationFocus &&
      !hasClientFocus &&
      !hasConversationFocus;
    const wantsOverduePaymentFocus = this.includesAny(lowerMessage, [
      'overdue',
      'late',
      'past due',
      'past-due',
    ]);
    const bookingPaymentFilter = hasPaymentFocus
      ? {
          proposals: {
            some: {
              contract: {
                project: {
                  payments: {
                    some: {
                      deletedAt: null,
                      status: {
                        in: [PaymentStatus.PENDING, PaymentStatus.FAILED],
                      },
                      ...(wantsOverduePaymentFocus
                        ? {
                            dueDate: {
                              lt: new Date(),
                            },
                          }
                        : {}),
                    },
                  },
                },
              },
            },
          },
        }
      : {};

    const [
      bookings,
      payments,
      contracts,
      projects,
      threads,
      notifications,
      conversations,
      clients,
      vendors,
    ] = await Promise.all([
      hasBookingFocus &&
      (hasSpecificText || onlyBookingFocus || broadSearch || hasPaymentFocus)
        ? this.prisma.lead.findMany({
            where: {
              deletedAt: null,
              ...this.buildLeadAccessWhere(user),
              ...bookingPaymentFilter,
              ...(hasSpecificText
                ? {
                    OR: [
                      {
                        eventType: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                      {
                        location: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                      {
                        city: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                      {
                        packageName: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                      {
                        packageLabel: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                      {
                        notes: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  }
                : {}),
            },
            include: assistantLeadInclude,
            orderBy: [{ eventDate: 'asc' }, { updatedAt: 'desc' }],
            take: 3,
          })
        : Promise.resolve([] as any[]),
      hasPaymentFocus || broadSearch
        ? this.prisma.payment.findMany({
            where: {
              deletedAt: null,
              ...this.buildPaymentAccessWhere(user),
              ...(this.includesAny(lowerMessage, [
                'unpaid',
                'overdue',
                'pending',
                'failed',
              ])
                ? {
                    status: {
                      in: [PaymentStatus.PENDING, PaymentStatus.FAILED],
                    },
                  }
                : {}),
              ...(hasSpecificText
                ? {
                    OR: [
                      {
                        notes: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                      {
                        gatewayOrderId: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                      {
                        transactionId: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                      {
                        project: {
                          contract: {
                            proposal: {
                              lead: {
                                eventType: {
                                  contains: searchText,
                                  mode: 'insensitive',
                                },
                              },
                            },
                          },
                        },
                      },
                      {
                        project: {
                          contract: {
                            proposal: {
                              lead: {
                                location: {
                                  contains: searchText,
                                  mode: 'insensitive',
                                },
                              },
                            },
                          },
                        },
                      },
                      {
                        project: {
                          client: {
                            name: {
                              contains: searchText,
                              mode: 'insensitive',
                            },
                          },
                        },
                      },
                    ],
                  }
                : {}),
            },
            include: {
              project: {
                include: {
                  client: {
                    select: assistantUserSelect,
                  },
                  contract: {
                    include: {
                      proposal: {
                        include: {
                          lead: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
            take: 3,
          })
        : Promise.resolve([] as any[]),
      hasContractFocus || broadSearch
        ? this.prisma.contract.findMany({
            where: {
              deletedAt: null,
              ...this.buildContractAccessWhere(user),
              ...(this.includesAny(lowerMessage, [
                'unsigned',
                'unread',
                'pending',
                'draft',
              ])
                ? {
                    status: {
                      in: [ContractStatus.DRAFT, ContractStatus.SENT],
                    },
                  }
                : {}),
              ...(hasSpecificText
                ? {
                    OR: [
                      {
                        proposal: {
                          lead: {
                            eventType: {
                              contains: searchText,
                              mode: 'insensitive',
                            },
                          },
                        },
                      },
                      {
                        proposal: {
                          lead: {
                            location: {
                              contains: searchText,
                              mode: 'insensitive',
                            },
                          },
                        },
                      },
                      {
                        project: {
                          client: {
                            name: {
                              contains: searchText,
                              mode: 'insensitive',
                            },
                          },
                        },
                      },
                    ],
                  }
                : {}),
            },
            include: {
              proposal: {
                include: {
                  lead: true,
                },
              },
              project: {
                include: {
                  client: {
                    select: assistantUserSelect,
                  },
                },
              },
              versions: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
            orderBy: { updatedAt: 'desc' },
            take: 3,
          })
        : Promise.resolve([] as any[]),
      hasProjectFocus && (hasSpecificText || onlyProjectFocus || broadSearch)
        ? this.prisma.project.findMany({
            where: {
              deletedAt: null,
              ...this.buildProjectAccessWhere(user),
              ...(hasSpecificText
                ? {
                    OR: [
                      {
                        summary: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                      {
                        contract: {
                          proposal: {
                            lead: {
                              eventType: {
                                contains: searchText,
                                mode: 'insensitive',
                              },
                            },
                          },
                        },
                      },
                      {
                        contract: {
                          proposal: {
                            lead: {
                              location: {
                                contains: searchText,
                                mode: 'insensitive',
                              },
                            },
                          },
                        },
                      },
                    ],
                  }
                : {}),
              ...(!hasSpecificText
                ? {
                    status: {
                      notIn: ['COMPLETED', 'CANCELLED'],
                    },
                  }
                : {}),
            },
            include: assistantProjectInclude,
            orderBy: { updatedAt: 'desc' },
            take: 3,
          })
        : Promise.resolve([] as any[]),
      (hasChatFocus || hasConversationFocus || broadSearch) &&
      (hasSpecificText || onlyChatFocus || onlyConversationFocus || broadSearch)
        ? this.prisma.conversationThread.findMany({
            where: {
              lead: {
                is: this.buildLeadAccessWhere(user),
              },
              messages: {
                some: {
                  senderId: {
                    not: user.userId,
                  },
                  readAt: null,
                },
              },
              ...(hasSpecificText && !hasUnreadFocus
                ? {
                    OR: [
                      {
                        messages: {
                          some: {
                            body: {
                              contains: searchText,
                              mode: 'insensitive',
                            },
                          },
                        },
                      },
                      {
                        lead: {
                          eventType: {
                            contains: searchText,
                            mode: 'insensitive',
                          },
                        },
                      },
                      {
                        lead: {
                          location: {
                            contains: searchText,
                            mode: 'insensitive',
                          },
                        },
                      },
                    ],
                  }
                : {}),
            },
            include: {
              lead: {
                select: {
                  id: true,
                  eventType: true,
                  location: true,
                  eventDate: true,
                },
              },
              messages: {
                where: {
                  senderId: {
                    not: user.userId,
                  },
                  readAt: null,
                },
                orderBy: { createdAt: 'desc' },
                take: 3,
              },
            },
            orderBy: { updatedAt: 'desc' },
            take: 3,
          })
        : Promise.resolve([] as any[]),
      hasNotificationFocus || broadSearch
        ? this.prisma.notification.findMany({
            where: {
              userId: user.userId,
              readAt: null,
              ...(hasSpecificText && !hasUnreadFocus
                ? {
                    OR: [
                      {
                        title: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                      {
                        body: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  }
                : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 3,
          })
        : Promise.resolve([] as any[]),
      hasConversationFocus || broadSearch
        ? this.prisma.aiConversation.findMany({
            where: {
              userId: user.userId,
              deletedAt: null,
              ...(hasSpecificText
                ? {
                    OR: [
                      {
                        title: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                      {
                        messages: {
                          some: {
                            content: {
                              contains: searchText,
                              mode: 'insensitive',
                            },
                          },
                        },
                      },
                      {
                        contexts: {
                          some: {
                            pageTitle: {
                              contains: searchText,
                              mode: 'insensitive',
                            },
                          },
                        },
                      },
                    ],
                  }
                : {}),
            },
            include: assistantConversationInclude,
            orderBy: [
              { isPinned: 'desc' },
              { pinnedAt: 'desc' },
              { lastMessageAt: 'desc' },
              { updatedAt: 'desc' },
            ],
            take: 3,
          })
        : Promise.resolve([] as any[]),
      (hasClientFocus || broadSearch) &&
      (hasSpecificText || onlyClientFocus || broadSearch)
        ? this.prisma.user.findMany({
            where: {
              deletedAt: null,
              role: Role.CLIENT,
              ...(hasSpecificText
                ? {
                    OR: [
                      {
                        name: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                      {
                        email: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                      {
                        phone: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  }
                : {}),
            },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              _count: {
                select: {
                  leads: true,
                  projects: true,
                },
              },
            },
            orderBy: [{ updatedAt: 'desc' }],
            take: 3,
          })
        : Promise.resolve([] as any[]),
      (hasVendorFocus || broadSearch) &&
      (hasSpecificText || onlyVendorFocus || broadSearch)
        ? this.prisma.vendor.findMany({
            where: {
              deletedAt: null,
              ...(hasSpecificText
                ? {
                    OR: [
                      {
                        name: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                      {
                        serviceType: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                      {
                        notes: {
                          contains: searchText,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  }
                : {}),
            },
            select: {
              id: true,
              name: true,
              serviceType: true,
              isAvailable: true,
              _count: {
                select: {
                  assignments: true,
                },
              },
            },
            orderBy: [{ updatedAt: 'desc' }],
            take: 3,
          })
        : Promise.resolve([] as any[]),
    ]);

    const buckets: Array<{
      label: string;
      count: number;
      highlight: string | null;
      action: AssistantAction | null;
    }> = [];

    if (bookings.length) {
      const lead = bookings[0];
      buckets.push({
        label: 'Bookings',
        count: bookings.length,
        highlight: `${lead.eventType} at ${lead.location}${lead.city ? `, ${lead.city}` : ''}`,
        action: createNavigateAssistantAction(
          'search-open-booking',
          'Open booking',
          this.getLeadHref(user, lead.id),
          'Open the strongest booking match.',
        ),
      });
    }

    if (payments.length) {
      const payment = payments[0];
      const lead = payment.project?.contract?.proposal?.lead;
      buckets.push({
        label: 'Payments',
        count: payments.length,
        highlight: `${payment.type} ${this.formatCurrency(payment.amount)}${payment.dueDate ? ` - due ${this.formatDate(payment.dueDate)}` : ''}${lead ? ` - ${lead.eventType}` : ''}`,
        action: createNavigateAssistantAction(
          'search-open-payments',
          'View payments',
          `${this.getPaymentsHref(user, lead?.id ?? null, payment.project?.id ?? null)}${this.getPaymentsHref(user, lead?.id ?? null, payment.project?.id ?? null).includes('?') ? '&' : '?'}paymentId=${payment.id}`,
          'Open the strongest payment match.',
        ),
      });
    }

    if (contracts.length) {
      const contract = contracts[0];
      const lead = contract.proposal?.lead;
      buckets.push({
        label: 'Contracts',
        count: contracts.length,
        highlight: `${contract.status}${lead ? ` - ${lead.eventType}` : ''}${contract.versions?.[0] ? ` - v${contract.versions[0].version}` : ''}`,
        action: createNavigateAssistantAction(
          'search-open-contracts',
          'Show contracts',
          `${this.getContractsHref(user, lead?.id ?? null)}${this.getContractsHref(user, lead?.id ?? null).includes('?') ? '&' : '?'}contractId=${contract.id}`,
          'Open the strongest contract match.',
        ),
      });
    }

    if (projects.length) {
      const project = projects[0];
      const lead = project.contract?.proposal?.lead;
      buckets.push({
        label: 'Projects',
        count: projects.length,
        highlight: `${project.status} - ${project.progress}% progress${lead ? ` - ${lead.eventType}` : ''}`,
        action: createNavigateAssistantAction(
          'search-open-projects',
          'Open project',
          `${this.getProjectHref(user, project.id, lead?.id ?? null)}${this.getProjectHref(user, project.id, lead?.id ?? null).includes('?') ? '&' : '?'}projectId=${project.id}`,
          'Open the strongest project match.',
        ),
      });
    }

    if (threads.length) {
      const thread = threads[0];
      buckets.push({
        label: 'Chats',
        count: threads.length,
        highlight: `${thread.lead.eventType} at ${thread.lead.location}${thread.messages.length ? ` - ${thread.messages.length} unread` : ''}`,
        action: createNavigateAssistantAction(
          'search-open-chat',
          'Open chat',
          `${this.getChatHref(user)}${this.getChatHref(user).includes('?') ? '&' : '?'}bookingId=${thread.lead.id}`,
          'Open the strongest chat match.',
        ),
      });
    }

    if (notifications.length) {
      const notification = notifications[0];
      buckets.push({
        label: 'Notifications',
        count: notifications.length,
        highlight: `${notification.title}${notification.body ? ` - ${notification.body.slice(0, 90)}` : ''}`,
        action: createNavigateAssistantAction(
          'search-open-notifications',
          'Open notifications',
          `${this.getNotificationsHref(user)}${this.getNotificationsHref(user).includes('?') ? '&' : '?'}notificationId=${notification.id}`,
          'Open unread notifications.',
        ),
      });
    }

    if (conversations.length) {
      const conversation = conversations[0];
      buckets.push({
        label: 'Beer threads',
        count: conversations.length,
        highlight: `${conversation.title}${conversation.preview ? ` - ${conversation.preview.slice(0, 80)}` : ''}`,
        action: null,
      });
    }

    if (clients.length) {
      const client = clients[0];
      buckets.push({
        label: 'Clients',
        count: clients.length,
        highlight: `${client.name ?? client.email ?? client.phone ?? 'Client'}${client._count?.leads ? ` - ${client._count.leads} bookings` : ''}`,
        action: createNavigateAssistantAction(
          'search-open-clients',
          'Open clients',
          `/admin/users?role=CLIENT&search=${encodeURIComponent(searchText)}`,
          'Open the matching client list.',
        ),
      });
    }

    if (vendors.length) {
      const vendor = vendors[0];
      buckets.push({
        label: 'Vendors',
        count: vendors.length,
        highlight: `${vendor.name} - ${vendor.serviceType}${vendor.isAvailable ? ' - available' : ' - unavailable'}`,
        action: createNavigateAssistantAction(
          'search-open-vendors',
          'Open vendors',
          `/admin/vendors?search=${encodeURIComponent(searchText)}`,
          'Open the matching vendor list.',
        ),
      });
    }

    const totalMatches = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
    const summary =
      totalMatches > 0
        ? `I found ${totalMatches} matching record${totalMatches === 1 ? '' : 's'} across ${buckets
            .slice(0, 3)
            .map((bucket) => bucket.label.toLowerCase())
            .join(', ')}.`
        : `I could not find an exact match for "${normalizedMessage}".`;
    const details = buckets.map((bucket) =>
      bucket.highlight
        ? `${bucket.label}: ${bucket.count} match${bucket.count === 1 ? '' : 'es'} - ${bucket.highlight}`
        : `${bucket.label}: ${bucket.count} match${bucket.count === 1 ? '' : 'es'}.`,
    );
    const actions = dedupeAssistantActions(
      buckets
        .map((bucket) => bucket.action)
        .filter(Boolean) as AssistantAction[],
    ).slice(0, 5);

    if (debugTrace) {
      const selectedScope = this.describeWorkspaceSearchScope({
        hasBookingFocus,
        hasPaymentFocus,
        hasContractFocus,
        hasProjectFocus,
        hasChatFocus,
        hasNotificationFocus,
        hasConversationFocus,
        hasClientFocus,
        hasVendorFocus,
        broadSearch,
      });

      debugTrace.retrieval = {
        searchText: searchText || normalizedMessage || null,
        semanticQuery: searchText || normalizedMessage || null,
        appliedFilters: this.sanitizeDebugRecord({
          searchText: searchText || null,
          hasSpecificText,
          selectedScope,
          hasBookingFocus,
          hasPaymentFocus,
          hasContractFocus,
          hasProjectFocus,
          hasChatFocus,
          hasNotificationFocus,
          hasConversationFocus,
          hasClientFocus,
          hasVendorFocus,
          hasUnreadFocus,
          broadSearch,
          onlyBookingFocus,
          onlyProjectFocus,
          onlyChatFocus,
          onlyConversationFocus,
          onlyClientFocus,
          onlyVendorFocus,
          followUpSearchSignal,
          wantsOverduePaymentFocus,
        }),
        selectedScope,
        memoryReferences: this.sanitizeDebugRecord({
          currentRole: priorMemory?.currentRole ?? null,
          currentPagePath: priorMemory?.currentPagePath ?? null,
          currentPageTitle: priorMemory?.currentPageTitle ?? null,
          lastSearchQuery: priorMemory?.lastSearchQuery ?? null,
          lastPrimaryIntent: priorMemory?.lastPrimaryIntent ?? null,
          selectedBookingId: priorMemory?.selectedBookingId ?? null,
          selectedProjectId: priorMemory?.selectedProjectId ?? null,
          city: priorMemory?.city ?? null,
          budgetPreference: priorMemory?.budgetPreference ?? null,
          bookingStatus: priorMemory?.bookingStatus ?? null,
          paymentStatus: priorMemory?.paymentStatus ?? null,
          contractStatus: priorMemory?.contractStatus ?? null,
        }),
        results: this.buildWorkspaceSearchDebugResults({
          searchText: searchText || normalizedMessage || '',
          lowerMessage,
          priorMemory,
          bookings,
          payments,
          contracts,
          projects,
          threads,
          notifications,
          conversations,
          clients,
          vendors,
        }),
      };
    }

    return {
      content: buildStructuredReply({
        summary,
        details: details.length
          ? details
          : [
              'I searched the bookings, payments, contracts, projects, chat, notification, and conversation records available in this workspace.',
              'Try a cleaner keyword or mention a booking name, city, client, or status.',
            ],
        nextActions: actions.length
          ? actions.map((action) => action.label)
          : ['Show bookings', 'Show payments', 'Show contracts'],
      }),
      actions,
      metadata: {
        responseType: 'workspace_search',
        searchQuery: normalizedMessage,
        searchTerms,
        searchResultCount: totalMatches,
        pageKey,
        section: deriveAssistantSection(context),
      },
    };
  }

  private async buildGreetingReply(
    user: AuthUser,
    pageKey: string,
    context?: AssistantContextInput,
    memory?: AssistantConversationMemory | null,
  ): Promise<AssistantTurn> {
    const summary = this.buildGreetingLead(user);
    const contextSentence = this.buildGreetingContextSentence(context, pageKey);

    return {
      content: buildAssistantResponseContent({
        style: 'greeting',
        summary,
        details: contextSentence ? [contextSentence] : [],
      }),
      actions: this.buildPromptChipActions(
        'greeting',
        this.buildGreetingChipLabels(user),
      ),
      metadata: {
        responseType: 'greeting',
        pageKey,
        section: context ? deriveAssistantSection(context) : 'general',
        memory,
      },
    };
  }

  private async buildDashboardHelpReply(
    user: AuthUser,
    context: AssistantContextInput,
    pageKey: string,
    lead: any | null,
    project: any | null,
    memory?: AssistantConversationMemory | null,
  ): Promise<AssistantTurn> {
    if (lead || project) {
      return this.buildPageOverviewReply(user, context, pageKey, lead, project);
    }

    return this.buildWorkspaceSnapshotReply(user, context, pageKey, memory);
  }

  private buildIdentityReply(
    user: AuthUser,
    context: AssistantContextInput,
    pageKey: string,
    memory?: AssistantConversationMemory | null,
  ): AssistantTurn {
    const summary = this.buildIdentityLead(user);

    return {
      content: buildAssistantResponseContent({
        style: 'identity',
        summary,
        details: [],
      }),
      actions: this.buildPromptChipActions(
        'identity',
        this.buildIdentityChipLabels(user),
      ),
      metadata: {
        responseType: 'identity',
        pageKey,
        section: context ? deriveAssistantSection(context) : 'general',
        memory,
      },
    };
  }

  private buildCapabilityReply(
    user: AuthUser,
    context: AssistantContextInput,
    pageKey: string,
    memory?: AssistantConversationMemory | null,
  ): AssistantTurn {
    const summary = this.buildCapabilityLead(user);
    const contextSentence = this.buildCapabilityContextSentence(context, pageKey);

    return {
      content: buildAssistantResponseContent({
        style: 'capability',
        summary,
        details: contextSentence ? [contextSentence] : [],
      }),
      actions: this.buildPromptChipActions(
        'capability',
        this.buildCapabilityChipLabels(user),
      ),
      metadata: {
        responseType: 'capability',
        pageKey,
        section: context ? deriveAssistantSection(context) : 'general',
        memory,
      },
    };
  }

  private async buildUserIdentityReply(
    user: AuthUser,
    context: AssistantContextInput,
    pageKey: string,
    memory?: AssistantConversationMemory | null,
    message?: string,
  ): Promise<AssistantTurn> {
    const normalizedMessage = message?.toLowerCase() ?? '';
    const profileName = await this.resolveUserDisplayName(user);
    const askedAboutMemory = this.includesAny(normalizedMessage, [
      'remember me',
      'do you remember me',
      'do you know me',
    ]);
    const askedAboutName = this.includesAny(normalizedMessage, [
      'what is my name',
      "what's my name",
      'do you know my name',
      'who am i',
    ]);
    const summary = profileName
      ? askedAboutMemory
        ? `Yes. You are logged in as ${profileName}, and I can keep the context in this thread grounded.`
        : askedAboutName
          ? `You are logged in as ${profileName}.`
          : `You are logged in as ${profileName}.`
      : askedAboutMemory
        ? "I remember the context in this thread, but I do not have a personal name on file unless you've shared it here."
        : "I do not know your name unless you've already shared it in this conversation.";

    return {
      content: summary,
      actions: this.buildPromptChipActions('user-identity', [
        'What do you remember?',
        'Show current booking',
        'Continue this thread',
      ]),
      metadata: {
        responseType: 'identity',
        pageKey,
        section: context ? deriveAssistantSection(context) : 'general',
        memory,
      },
    };
  }

  private buildPersonalReply(
    user: AuthUser,
    context: AssistantContextInput,
    pageKey: string,
    memory?: AssistantConversationMemory | null,
    message?: string,
  ): AssistantTurn {
    const normalizedMessage = message?.toLowerCase() ?? '';
    const isHelpRequest = this.includesAny(normalizedMessage, [
      'can you help me',
      'help me',
      'help',
    ]);
    const summary = isHelpRequest
      ? 'Yes. I can help with bookings, payments, contracts, chats, notifications, and tasks.'
      : "I'm good. I'm here to help with the workspace and keep things moving.";

    return {
      content: summary,
      actions: this.buildPromptChipActions('personal', [
        'What can you do?',
        user.role === Role.ADMIN
          ? 'Show what needs attention'
          : user.role === Role.VENDOR
            ? 'Show assignments'
            : 'Show my booking',
        'Continue this thread',
      ]),
      metadata: {
        responseType: 'direct_answer',
        pageKey,
        section: context ? deriveAssistantSection(context) : 'general',
        memory,
      },
    };
  }

  private buildUnsupportedPersonalDataReply(
    user: AuthUser,
    context: AssistantContextInput,
    pageKey: string,
    memory?: AssistantConversationMemory | null,
    message?: string,
  ): AssistantTurn {
    void message;
    const summary = user.name
      ? `You are logged in as ${user.name}. I won't guess other personal details unless you've shared them here.`
      : "I can't safely guess personal details like that unless you've already shared them here.";

    return {
      content: summary,
      actions: this.buildPromptChipActions('personal-data', [
        'What do you remember?',
        'Show current booking',
        'Continue this thread',
      ]),
      metadata: {
        responseType: 'unsupported_request',
        pageKey,
        section: context ? deriveAssistantSection(context) : 'general',
        memory,
        unsupportedReason: 'personal_data_unavailable',
      },
    };
  }

  private buildOffTopicReply(
    user: AuthUser,
    context: AssistantContextInput,
    pageKey: string,
    memory?: AssistantConversationMemory | null,
    message?: string,
  ): AssistantTurn {
    void user;
    void message;
    return {
      content:
        'I stay focused on bookings, payments, chats, contracts, and tasks here. If you want, I can still help you move the current workspace work forward.',
      actions: this.buildPromptChipActions('off-topic', [
        'What can you do?',
        'Show what needs attention',
        'Show my booking',
      ]),
      metadata: {
        responseType: 'direct_answer',
        pageKey,
        section: context ? deriveAssistantSection(context) : 'general',
        memory,
      },
    };
  }

  private async resolveUserDisplayName(user: AuthUser) {
    if (typeof user.name === 'string' && user.name.trim()) {
      return user.name.trim();
    }

    const userModel = (this.prisma as PrismaService & {
      user?: {
        findUnique?: (args: {
          where: { id: string };
          select: { name: boolean };
        }) => Promise<{ name: string | null } | null>;
      };
    }).user;

    if (!userModel?.findUnique) {
      return null;
    }

    try {
      const profile = await userModel.findUnique({
        where: { id: user.userId },
        select: { name: true },
      });

      return typeof profile?.name === 'string' && profile.name.trim()
        ? profile.name.trim()
        : null;
    } catch {
      return null;
    }
  }

  private buildServiceRecommendationReply(
    user: AuthUser,
    context: AssistantContextInput,
    memory: AssistantBookingInsight,
    classification: AssistantClassification,
    message: string,
  ): AssistantTurn {
    void classification;
    const normalizedMessage = message.toLowerCase();
    const pageKey = deriveAssistantPageKey(user.role, context.pagePath, context);
    const serviceLabel = this.getServiceLabel(memory.serviceSlug) ?? 'private celebration';
    const chips = [
      'House party',
      'Private celebration',
      'Compare setups',
      memory.city ? `Show ${memory.city} options` : null,
    ].filter(Boolean) as string[];

    const summary = this.includesAny(normalizedMessage, [
      'friends party',
      'party with friends',
      'college friends',
      'friends gathering',
      'friends get together',
    ])
      ? `For a friends party, the closest fit is usually a house party or ${serviceLabel.toLowerCase()}.`
      : `The closest fit is usually a house party or ${serviceLabel.toLowerCase()}.`;

    const detailBits = [
      memory.city ? `${memory.city} looks like a good match.` : null,
      memory.guestCount ? `${memory.guestCount} guests gives me a better read on the setup.` : null,
      memory.indoorOutdoor ? `You want it ${memory.indoorOutdoor}.` : null,
      memory.foodRequirement ? `Food: ${memory.foodRequirement}.` : null,
      memory.drinkRequirement
        ? `Drink setup: ${memory.drinkRequirement === 'dry' ? 'dry' : 'alcoholic'}.`
        : null,
    ].filter(Boolean);

    return {
      content:
        detailBits.length > 0
          ? `${summary} ${detailBits[0]} If you want, I can narrow it down further by drinks, snacks, or guest count.`
          : `${summary} If it is a bigger group with music, drinks, or outdoor setup, I can narrow it down further.`,
      actions: this.buildPromptChipActions('service-recommendation', chips),
      metadata: {
        responseType: 'booking_recommendation',
        pageKey,
        bookingMemory: memory,
        serviceRecommendation: memory.serviceSlug ?? null,
      },
    };
  }

  private buildGreetingLead(user: AuthUser) {
    switch (user.role) {
      case Role.ADMIN:
        return "Hey, I'm Beer. I can help with overdue payments, unread chats, stalled bookings, contracts, and pending tasks.";
      case Role.VENDOR:
        return "Hey, I'm Beer. I can help with schedules, assignments, payment release items, and delivery follow-up.";
      case Role.CLIENT:
        return "Hi, I'm Beer. I can help with bookings, payments, contracts, unread chats, and the next step on this event.";
      default:
        return "Hi, I'm Beer. I can help with bookings, tasks, payments, contracts, and what needs attention next.";
    }
  }

  private buildIdentityLead(user: AuthUser) {
    void user;
    return "I'm Beer, the in-site assistant. I can help with bookings, payments, chats, contracts, and tasks.";
  }

  private buildCapabilityLead(user: AuthUser) {
    switch (user.role) {
      case Role.ADMIN:
        return 'I can help you check overdue payments, unread chats, blocked bookings, contracts, and pending tasks.';
      case Role.VENDOR:
        return 'I can help you review schedules, assignments, payment release items, and delivery follow-up.';
      case Role.CLIENT:
        return 'I can help you understand bookings, what is pending, payments, contracts, unread chats, and the next step.';
      default:
        return 'I can help you review bookings, tasks, payments, contracts, unread chats, and the next move.';
    }
  }

  private buildGreetingContextSentence(
    context?: AssistantContextInput,
    pageKey?: string,
  ) {
    if (!context) {
      return null;
    }

    const section = deriveAssistantSection(context);

    if (
      pageKey === 'workspace-dashboard' ||
      ['general', 'notifications'].includes(section)
    ) {
      return 'Since you are on the dashboard, I can show what needs attention right now.';
    }

    const contextBySection: Record<string, string> = {
      bookings: 'Since you are on bookings, I can keep this focused on the current booking.',
      payments: 'Since you are on payments, I can focus on what is still pending.',
      contracts: 'Since you are on contracts, I can focus on the latest version and what is left to sign.',
      chat: 'Since you are in chat, I can focus on unread threads and the next reply.',
      projects: 'Since you are on projects, I can keep this focused on delivery and blockers.',
      timeline: 'Since you are on the timeline, I can keep this focused on what is moving or slipping.',
      documents: 'Since you are in documents, I can keep this focused on the latest files and missing uploads.',
      service: 'Since you are on a service page, I can help narrow the best fit.',
    };

    return contextBySection[section] ?? null;
  }

  private buildCapabilityContextSentence(
    context?: AssistantContextInput,
    pageKey?: string,
  ) {
    if (!context) {
      return null;
    }

    const section = deriveAssistantSection(context);

    if (
      pageKey === 'workspace-dashboard' ||
      ['general', 'notifications'].includes(section)
    ) {
      return 'I can stay page-aware without turning the page into the whole answer.';
    }

    const contextBySection: Record<string, string> = {
      bookings: 'On bookings, I can help with the brief, budget, and next move.',
      payments: 'On payments, I can help with what is due, overdue, or still pending.',
      contracts: 'On contracts, I can help with draft, sent, and signed stages.',
      chat: 'In chat, I can help with unread threads and draft replies.',
      projects: 'On projects, I can help with tasks, ownership, and blockers.',
      timeline: 'On the timeline, I can help with deadlines and what is slipping.',
      documents: 'In documents, I can help with the latest version and missing uploads.',
      service: 'On a service page, I can help compare the best fit and move you into booking.',
    };

    return contextBySection[section] ?? null;
  }

  private buildGreetingChipLabels(user: AuthUser) {
    switch (user.role) {
      case Role.ADMIN:
        return [
          'What needs attention?',
          'Show overdue payments',
          'Show unread chats',
          'Show blocked bookings',
        ];
      case Role.CLIENT:
        return [
          'Summarize this booking',
          'What is pending?',
          'Draft a reply',
          'Estimate budget',
        ];
      case Role.VENDOR:
        return [
          'Show assignments',
          'Show schedule',
          'Show payment release',
          'Draft update',
        ];
      default:
        return [
          'What needs attention?',
          'Show bookings',
          'Show payments',
          'Draft a reply',
        ];
    }
  }

  private buildIdentityChipLabels(user: AuthUser) {
    switch (user.role) {
      case Role.ADMIN:
        return ['What can you do?', 'Show what needs attention', 'Show unread chats'];
      case Role.CLIENT:
        return ['What can you do?', 'Show my booking', 'What is pending?'];
      case Role.VENDOR:
        return ['What can you do?', 'Show assignments', 'Show schedule'];
      default:
        return ['What can you do?', 'Show current context', 'Show bookings'];
    }
  }

  private buildCapabilityChipLabels(user: AuthUser) {
    switch (user.role) {
      case Role.ADMIN:
        return [
          'Show overdue payments',
          'Show unread chats',
          'Show blocked bookings',
          'Show unsigned contracts',
        ];
      case Role.CLIENT:
        return ['Show bookings', 'Show payments', 'Show contracts', 'Draft a reply'];
      case Role.VENDOR:
        return ['Show assignments', 'Show schedule', 'Show payment release', 'Draft update'];
      default:
        return ['Show bookings', 'Show tasks', 'Show payments', 'Draft a reply'];
    }
  }

  private buildPageOverviewChipLabels(user: AuthUser, section: string) {
    switch (section) {
      case 'bookings':
        return ['Summarize booking', 'What is pending?', 'Draft a reply'];
      case 'payments':
        return ['Show overdue payments', 'Draft reminder', 'Open booking'];
      case 'contracts':
        return ['Show unsigned contracts', 'Draft follow-up', 'Open booking'];
      case 'chat':
        return ['Show unread chats', 'Draft reply', 'Open booking'];
      case 'projects':
        return ['Show pending tasks', 'Draft update', 'Open assignments'];
      case 'notifications':
        return ['What needs attention?', 'Show overdue payments', 'Show unread chats'];
      default:
        return user.role === Role.ADMIN
          ? ['What needs attention?', 'Show overdue payments', 'Show unread chats', 'Show blocked bookings']
          : user.role === Role.CLIENT
            ? ['Summarize this booking', 'What is pending?', 'Draft a reply']
            : user.role === Role.VENDOR
              ? ['Show assignments', 'Show schedule', 'Draft update']
              : ['What needs attention?', 'Show bookings', 'Draft a reply'];
    }
  }

  private buildPromptChipActions(prefix: string, labels: string[]) {
    return labels.slice(0, 4).map((label, index) => {
      const promptLabel = label.replace(/[?!.]+$/g, '').toLowerCase();

      return createDraftAssistantAction(
        `${prefix}-${index}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label,
        label,
        `Ask Beer to ${promptLabel}.`,
      );
    });
  }

  private async buildWorkspaceSnapshotReply(
    user: AuthUser,
    context: AssistantContextInput,
    pageKey: string,
    memory?: AssistantConversationMemory | null,
  ): Promise<AssistantTurn> {
    const snapshot = await this.getWorkspaceSnapshot(user);
    const actions = this.buildWorkspaceSnapshotActions(user);

    if (user.role === Role.CLIENT && snapshot.pendingPayments.count) {
      actions.unshift(
        createDraftAssistantAction(
          'workspace-draft-reminder',
          'Draft reminder',
          'Draft a payment reminder for this booking.',
          'Draft a reminder for the pending payment.',
        ),
      );
    } else if (user.role === Role.ADMIN && snapshot.overduePayments.count) {
      actions.unshift(
        createDraftAssistantAction(
          'workspace-draft-overdue',
          'Draft reminder',
          'Draft a payment reminder for the overdue items in this workspace.',
          'Draft a reminder for the overdue payments.',
        ),
      );
    } else if (
      snapshot.awaitingSignatureCount &&
      (user.role === Role.CLIENT || user.role === Role.ADMIN)
    ) {
      actions.unshift(
        createDraftAssistantAction(
          'workspace-draft-contract-followup',
          'Draft follow-up',
          'Draft a contract follow-up for this booking.',
          'Draft a follow-up for the unsigned contract.',
        ),
      );
    }

    const visibleActions = dedupeAssistantActions(actions).slice(0, 4);

    const summary =
      user.role === Role.CLIENT
        ? snapshot.pendingPayments.count || snapshot.awaitingSignatureCount
          ? `You have ${snapshot.pendingPayments.count} payment item${snapshot.pendingPayments.count === 1 ? '' : 's'} and ${snapshot.awaitingSignatureCount} contract${snapshot.awaitingSignatureCount === 1 ? '' : 's'} waiting for movement.`
          : snapshot.upcomingEvent
            ? `Your next event is ${snapshot.upcomingEvent.eventType} on ${this.formatDate(snapshot.upcomingEvent.eventDate)}.`
            : 'Your workspace looks calm right now, with no urgent commercial blockers in view.'
        : user.role === Role.ADMIN
          ? `I am seeing ${snapshot.unreadThreads} unread chat thread${snapshot.unreadThreads === 1 ? '' : 's'}, ${snapshot.overduePayments.count} overdue payment${snapshot.overduePayments.count === 1 ? '' : 's'}, ${snapshot.pendingContracts.count} contract${snapshot.pendingContracts.count === 1 ? '' : 's'} needing movement, plus ${snapshot.unassignedBookings} unassigned booking${snapshot.unassignedBookings === 1 ? '' : 's'} and ${snapshot.stalledProjects} stalled project${snapshot.stalledProjects === 1 ? '' : 's'}.`
          : user.role === Role.VENDOR
            ? `You have ${snapshot.activeProjects} active assignment${snapshot.activeProjects === 1 ? '' : 's'}, ${snapshot.pendingPayments.count} payment release item${snapshot.pendingPayments.count === 1 ? '' : 's'}, and ${snapshot.missingUploads} project${snapshot.missingUploads === 1 ? '' : 's'} still waiting on uploads.`
            : `You have ${snapshot.activeProjects} active assignment${snapshot.activeProjects === 1 ? '' : 's'}, ${snapshot.pendingTasks} open task${snapshot.pendingTasks === 1 ? '' : 's'}, and ${snapshot.unreadThreads} unread chat thread${snapshot.unreadThreads === 1 ? '' : 's'} needing movement.`;

    const details =
      user.role === Role.CLIENT
        ? [
            snapshot.unreadThreads
              ? `${snapshot.unreadThreads} unread chat thread${snapshot.unreadThreads === 1 ? '' : 's'} still need a response`
              : null,
            snapshot.pendingPayments.count
              ? `${snapshot.pendingPayments.count} payment milestone${snapshot.pendingPayments.count === 1 ? '' : 's'} remain, totaling ${this.formatCurrency(snapshot.pendingPayments.amount)}`
              : null,
            snapshot.awaitingSignatureCount
              ? `${snapshot.awaitingSignatureCount} contract${snapshot.awaitingSignatureCount === 1 ? '' : 's'} are still waiting for signature`
              : null,
            snapshot.unreadNotifications
              ? `${snapshot.unreadNotifications} unread notification${snapshot.unreadNotifications === 1 ? '' : 's'} are still on the board`
              : null,
            snapshot.upcomingEvent
              ? `Next event: ${snapshot.upcomingEvent.eventType} at ${snapshot.upcomingEvent.location ?? 'TBD'}`
              : null,
          ]
        : user.role === Role.ADMIN
          ? [
              snapshot.unreadThreads
                ? `${snapshot.unreadThreads} client chat thread${snapshot.unreadThreads === 1 ? '' : 's'} still need triage`
                : null,
              snapshot.overduePayments.count
                ? `${snapshot.overduePayments.count} overdue payment${snapshot.overduePayments.count === 1 ? '' : 's'} total ${this.formatCurrency(snapshot.overduePayments.amount)}`
                : null,
              snapshot.pendingContracts.count
                ? `${snapshot.pendingContracts.count} contract${snapshot.pendingContracts.count === 1 ? '' : 's'} are still in draft or sent status`
                : null,
              snapshot.staffingGaps
                ? `${snapshot.staffingGaps} booking${snapshot.staffingGaps === 1 ? '' : 's'} still have no active staff assigned`
                : null,
              snapshot.unassignedBookings
                ? `${snapshot.unassignedBookings} booking${snapshot.unassignedBookings === 1 ? '' : 's'} are waiting on assignment`
                : null,
              snapshot.stalledProjects
                ? `${snapshot.stalledProjects} project${snapshot.stalledProjects === 1 ? '' : 's'} have gone quiet for more than a week`
                : null,
              snapshot.upcomingEvent
                ? `Next event in scope: ${snapshot.upcomingEvent.eventType} on ${this.formatDate(snapshot.upcomingEvent.eventDate)}`
                : null,
            ]
          : user.role === Role.VENDOR
            ? [
                snapshot.upcomingEvent
                  ? `Next event: ${snapshot.upcomingEvent.eventType} on ${this.formatDate(snapshot.upcomingEvent.eventDate)}`
                  : null,
                snapshot.pendingPayments.count
                  ? `${snapshot.pendingPayments.count} payment item${snapshot.pendingPayments.count === 1 ? '' : 's'} are still pending release`
                  : null,
                snapshot.missingUploads
                  ? `${snapshot.missingUploads} active assignment${snapshot.missingUploads === 1 ? '' : 's'} still need uploads or documents`
                  : null,
                snapshot.pendingTasks
                  ? `${snapshot.pendingTasks} delivery task${snapshot.pendingTasks === 1 ? '' : 's'} are still open`
                  : null,
              ]
            : [
                snapshot.unreadThreads
                  ? `${snapshot.unreadThreads} unread client chat thread${snapshot.unreadThreads === 1 ? '' : 's'} need attention`
                  : null,
                snapshot.pendingTasks
                  ? `${snapshot.pendingTasks} open task${snapshot.pendingTasks === 1 ? '' : 's'} are still moving through execution`
                  : null,
                snapshot.overdueTasks
                  ? `${snapshot.overdueTasks} task${snapshot.overdueTasks === 1 ? '' : 's'} are overdue`
                  : null,
                snapshot.missingUploads
                  ? `${snapshot.missingUploads} project${snapshot.missingUploads === 1 ? '' : 's'} still have upload gaps`
                  : null,
                snapshot.pendingPayments.count
                  ? `${snapshot.pendingPayments.count} booking${snapshot.pendingPayments.count === 1 ? '' : 's'} still need payment follow-up`
                  : null,
              ];

    const recentNotificationLine = snapshot.recentNotifications?.length
      ? `Latest alert: ${snapshot.recentNotifications[0].title}`
      : null;
    const recentActionLine = snapshot.recentAssistantActions?.length
      ? `Recent action: ${snapshot.recentAssistantActions[0].label}`
      : null;
    const enrichedDetails = [
      ...details,
      recentNotificationLine,
      recentActionLine,
    ].filter(Boolean) as string[];

    return {
      content: buildStructuredReply({
        summary,
        details: enrichedDetails,
        nextActions: visibleActions.map((action) => action.label),
      }),
      actions: visibleActions,
      metadata: {
        responseType: 'dashboard_snapshot',
        unreadNotifications: snapshot.unreadNotifications,
        unreadThreadCount: snapshot.unreadThreads,
        unreadMessageCount: snapshot.unreadMessages,
        overduePaymentCount: snapshot.overduePayments.count,
        unsignedContractCount: snapshot.awaitingSignatureCount,
        pendingTaskCount: snapshot.pendingTasks,
        upcomingEventCount: snapshot.upcomingEvent ? 1 : 0,
        staffingGapCount: snapshot.staffingGaps,
        unassignedBookingCount: snapshot.unassignedBookings,
        stalledProjectCount: snapshot.stalledProjects,
        missingUploadCount: snapshot.missingUploads,
        pageKey,
        section: deriveAssistantSection(context),
        memory,
      },
    };
  }

  private buildWorkspaceSnapshotActions(user: AuthUser) {
    const actions: AssistantAction[] = [];

    if (user.role !== Role.VENDOR) {
      actions.push(
        createNavigateAssistantAction(
          'workspace-open-chat',
          'Show unread chats',
          this.getChatHref(user),
          'Open the messaging workspace.',
        ),
      );
    }

    if (user.role === Role.CLIENT) {
      actions.push(
        createNavigateAssistantAction(
          'workspace-open-bookings',
          'Show bookings',
          '/dashboard/bookings',
          'Open the client booking workspace.',
        ),
        createNavigateAssistantAction(
          'workspace-start-booking',
          'Start booking',
          this.getCreateBookingHref(user),
          'Create or continue a booking.',
        ),
      );
    }

    if (user.role === Role.ADMIN) {
      actions.push(
        createNavigateAssistantAction(
          'workspace-open-payments',
          'Show overdue payments',
          this.getPaymentsHref(user),
          'Open the payments workspace.',
        ),
        createNavigateAssistantAction(
          'workspace-open-bookings',
          'Show blocked bookings',
          '/admin/bookings',
          'Open the booking queue.',
        ),
        createNavigateAssistantAction(
          'workspace-open-contracts',
          'Show unsigned contracts',
          this.getContractsHref(user),
          'Open the contract queue.',
        ),
        createNavigateAssistantAction(
          'workspace-open-pipeline',
          'Open pipeline',
          '/admin/pipeline',
          'Review the commercial pipeline.',
        ),
      );
    }

    if (user.role !== Role.CLIENT && user.role !== Role.VENDOR) {
      actions.push(
        createNavigateAssistantAction(
          'workspace-open-tasks',
          'Show pending tasks',
          this.getTasksHref(user),
          'Open the active task view.',
        ),
      );
    }

    if (
      user.role === Role.ADMIN ||
      user.role === Role.SALES ||
      user.role === Role.OPS ||
      user.role === Role.FINANCE
    ) {
      actions.push(
        createNavigateAssistantAction(
          'workspace-open-notifications',
          'Show alerts',
          this.getNotificationsHref(user),
          'Review unread operational notifications.',
        ),
      );
    }

    if (user.role === Role.VENDOR) {
      actions.push(
        createNavigateAssistantAction(
          'workspace-open-vendor',
          'Show assignments',
          '/vendor',
          'Return to your assignment workspace.',
        ),
      );
    }

    return dedupeAssistantActions(actions).slice(0, 4);
  }

  private async getWorkspaceSnapshot(user: AuthUser) {
    const now = new Date();
    const unreadNotificationPromise = this.prisma.notification.count({
      where: {
        userId: user.userId,
        readAt: null,
      },
    });
    const recentNotificationPromise = this.prisma.notification.findMany({
      where: {
        userId: user.userId,
        readAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: {
        id: true,
        title: true,
        body: true,
        actionUrl: true,
        type: true,
        createdAt: true,
      },
    });
    const recentAssistantActionPromise = this.prisma.aiAssistantEvent.findMany({
      where: {
        userId: user.userId,
        eventType: 'action_clicked',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        label: true,
        pageKey: true,
        section: true,
        metadata: true,
        createdAt: true,
      },
    });
    const unreadThreadPromise: Promise<Array<{ messages: Array<unknown> }>> =
      user.role === Role.VENDOR
        ? Promise.resolve([])
        : this.prisma.conversationThread.findMany({
            where: {
              lead: {
                is: this.buildLeadAccessWhere(user),
              },
              messages: {
                some: {
                  senderId: {
                    not: user.userId,
                  },
                  readAt: null,
                },
              },
            },
            include: {
              lead: {
                select: {
                  id: true,
                  eventType: true,
                  location: true,
                  eventDate: true,
                },
              },
              messages: {
                where: {
                  senderId: {
                    not: user.userId,
                  },
                  readAt: null,
                },
                orderBy: { createdAt: 'desc' },
                take: 5,
              },
            },
            orderBy: { updatedAt: 'desc' },
            take: 6,
          });
    const overduePaymentsPromise = this.prisma.payment.aggregate({
      where: {
        deletedAt: null,
        status: {
          in: [PaymentStatus.PENDING, PaymentStatus.FAILED],
        },
        dueDate: {
          lt: now,
        },
        ...this.buildPaymentAccessWhere(user),
      },
      _count: {
        _all: true,
      },
      _sum: {
        amount: true,
      },
    });
    const pendingPaymentsPromise = this.prisma.payment.aggregate({
      where: {
        deletedAt: null,
        status: {
          in: [PaymentStatus.PENDING, PaymentStatus.FAILED],
        },
        ...this.buildPaymentAccessWhere(user),
      },
      _count: {
        _all: true,
      },
      _sum: {
        amount: true,
      },
    });
    const pendingContractsPromise = this.prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: {
          in: [ContractStatus.DRAFT, ContractStatus.SENT],
        },
        ...this.buildContractAccessWhere(user),
      },
      include: {
        proposal: {
          include: {
            lead: true,
          },
        },
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    });
    const pendingContractCountPromise = this.prisma.contract.count({
      where: {
        deletedAt: null,
        status: {
          in: [ContractStatus.DRAFT, ContractStatus.SENT],
        },
        ...this.buildContractAccessWhere(user),
      },
    });
    const awaitingSignatureCountPromise = this.prisma.contract.count({
      where: {
        deletedAt: null,
        status: ContractStatus.SENT,
        ...this.buildContractAccessWhere(user),
      },
    });
    const pendingTaskWhere =
      user.role === Role.VENDOR
        ? {
            deletedAt: null,
            status: {
              not: ProjectTaskStatus.DONE,
            },
            assignedVendor: {
              is: {
                userId: user.userId,
                deletedAt: null,
              },
            },
          }
        : {
            deletedAt: null,
            status: {
              not: ProjectTaskStatus.DONE,
            },
            project: this.buildProjectAccessWhere(user),
          };
    const pendingTaskPromise = this.prisma.projectTask.count({
      where: pendingTaskWhere,
    });
    const overdueTaskPromise = this.prisma.projectTask.count({
      where: {
        ...pendingTaskWhere,
        dueDate: {
          lt: now,
        },
      },
    });
    const upcomingEventPromise = this.prisma.lead.findFirst({
      where: {
        deletedAt: null,
        eventDate: {
          gte: now,
        },
        ...this.buildLeadAccessWhere(user),
      },
      select: {
        id: true,
        eventType: true,
        location: true,
        eventDate: true,
      },
      orderBy: { eventDate: 'asc' },
    });
    const activeProjectPromise = this.prisma.project.count({
      where: {
        deletedAt: null,
        status: {
          notIn: ['COMPLETED', 'CANCELLED'],
        },
        ...this.buildProjectAccessWhere(user),
      },
    });
    const unassignedBookingPromise = this.prisma.lead.count({
      where: {
        deletedAt: null,
        ...this.buildLeadAccessWhere(user),
        assignments: {
          none: {
            isActive: true,
          },
        },
      },
    });
    const stalledProjectPromise = this.prisma.project.count({
      where: {
        deletedAt: null,
        status: {
          notIn: ['COMPLETED', 'CANCELLED'],
        },
        updatedAt: {
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        ...this.buildProjectAccessWhere(user),
      },
    });
    const staffingGapPromise =
      user.role === Role.ADMIN
        ? this.prisma.project.count({
            where: {
              deletedAt: null,
              status: {
                notIn: ['COMPLETED', 'CANCELLED'],
              },
              assignments: {
                none: {
                  isActive: true,
                },
              },
            },
          })
        : Promise.resolve(0);
    const missingUploadPromise = this.prisma.project.count({
      where: {
        deletedAt: null,
        status: {
          notIn: ['COMPLETED', 'CANCELLED'],
        },
        ...this.buildProjectAccessWhere(user),
        documents: {
          none: {},
        },
      },
    });

    const [
      unreadNotifications,
      recentNotifications,
      recentAssistantActions,
      unreadThreads,
      overduePayments,
      pendingPayments,
      pendingContracts,
      pendingContractCount,
      awaitingSignatureCount,
      pendingTasks,
      overdueTasks,
      upcomingEvent,
      activeProjects,
      staffingGaps,
      unassignedBookings,
      stalledProjects,
      missingUploads,
    ] = await Promise.all([
      unreadNotificationPromise,
      recentNotificationPromise,
      recentAssistantActionPromise,
      unreadThreadPromise,
      overduePaymentsPromise,
      pendingPaymentsPromise,
      pendingContractsPromise,
      pendingContractCountPromise,
      awaitingSignatureCountPromise,
      pendingTaskPromise,
      overdueTaskPromise,
      upcomingEventPromise,
      activeProjectPromise,
      staffingGapPromise,
      unassignedBookingPromise,
      stalledProjectPromise,
      missingUploadPromise,
    ]);

    return {
      unreadNotifications,
      recentNotifications,
      recentAssistantActions,
      unreadThreads: unreadThreads.length,
      unreadMessages: unreadThreads.reduce(
        (sum: number, thread) => sum + thread.messages.length,
        0,
      ),
      overduePayments: {
        count: overduePayments._count._all,
        amount: overduePayments._sum.amount ?? 0,
      },
      pendingPayments: {
        count: pendingPayments._count._all,
        amount: pendingPayments._sum.amount ?? 0,
      },
      pendingContracts: {
        count: pendingContractCount,
        draftCount: pendingContracts.filter(
          (contract) => contract.status === ContractStatus.DRAFT,
        ).length,
        sentCount: pendingContracts.filter(
          (contract) => contract.status === ContractStatus.SENT,
        ).length,
      },
      awaitingSignatureCount,
      pendingTasks,
      overdueTasks,
      upcomingEvent,
      activeProjects,
      staffingGaps,
      unassignedBookings,
      stalledProjects,
      missingUploads,
    };
  }

  private buildFallbackReply(
    user: AuthUser,
    pageKey: string,
    context?: AssistantContextInput,
    memory?: AssistantConversationMemory | null,
    input?: {
      message?: string;
      classification?: AssistantClassification | null;
      history?: AssistantHistoryEntry[];
      understanding?: AssistantLlmUnderstandingOutput | null;
    },
  ): AssistantTurn {
    const suggestions = getDefaultPromptSuggestions(user.role, pageKey);
    const section = context ? deriveAssistantSection(context) : 'general';
    const normalizedMessage = input?.message?.trim() ?? '';

    if (
      input?.classification?.primaryIntent === 'unsupported_request' ||
      detectUnsupportedRequest(normalizedMessage)
    ) {
      return this.buildUnsupportedReply(
        user,
        context ?? {},
        normalizedMessage,
        input?.classification ?? null,
        memory,
        pageKey,
      );
    }

    const shouldEscalate =
      (memory?.fallbackCount ?? 0) >= 1 ||
      this.isFrustrationText(normalizedMessage) ||
      this.isUnsupportedActionText(normalizedMessage);

    if (shouldEscalate) {
      return this.buildEscalationReply(
        user,
        context ?? {},
        null,
        null,
        normalizedMessage,
        input?.classification ?? null,
        memory,
        pageKey,
      );
    }

    if (
      input?.classification &&
      (input.classification.primaryIntent === 'clarification_request' ||
        this.isLowConfidenceClassification(input.classification))
    ) {
      return this.buildClarificationReply(
        user,
        context ?? {},
        null,
        null,
        normalizedMessage,
        input.classification,
        memory,
        pageKey,
        input.history ?? [],
        input.understanding ?? null,
      );
    }

    return {
      content: buildContextualFallbackCopy({
        role: user.role,
        section,
        promptSuggestions: suggestions,
        memory,
      }),
      actions: suggestions
        .slice(0, 3)
        .map((suggestion) =>
          createDraftAssistantAction(
            `suggestion-${suggestion.id}`,
            suggestion.title,
            suggestion.prompt,
            suggestion.description,
          ),
        ),
      metadata: {
        responseType: 'fallback',
        pageKey,
        section,
      },
    };
  }

  private getCleanUnderstandingQuestion(value?: string | null) {
    if (typeof value !== 'string') {
      return '';
    }

    return value.replace(/\s+/g, ' ').trim().slice(0, 240);
  }

  private buildClarificationReply(
    user: AuthUser,
    context: AssistantContextInput,
    lead: any | null,
    project: any | null,
    message: string,
    classification: AssistantClassification | null,
    memory?: AssistantConversationMemory | null,
    pageKey?: string,
    history: AssistantHistoryEntry[] = [],
    understanding?: AssistantLlmUnderstandingOutput | null,
  ): AssistantTurn {
    const normalized = message.toLowerCase().trim();
    const recentSummary = this.buildRecentThreadSummary(history);
    const clarificationKind = this.resolveClarificationKind(
      normalized,
      classification,
      memory,
    );
    const currentPage =
      context.pageTitle ?? context.pagePath ?? pageKey ?? 'current workspace';

    const questionByKind: Record<string, string> = {
      budget:
        'Do you want me to make the same booking cheaper, or trim a few services?',
      venue: 'Do you want to keep it indoors or move outdoors?',
      city: 'Do you want to change the city, or keep the current one?',
      payment: 'Do you mean the next payment due, or the full remaining amount?',
      contract: 'Do you mean the latest contract, or the signed one?',
      chat: 'Do you want me to open the unread thread, or draft another reminder?',
      assignment:
        'Do you mean the assigned person, the backup owner, or the current coordinator?',
      booking: 'Do you mean the current booking, or another one?',
      general: 'Which one should I switch to?',
    };

    const modelClarification = this.getCleanUnderstandingQuestion(
      understanding?.clarificationQuestion,
    );
    const summary =
      modelClarification ||
      questionByKind[clarificationKind] ||
      questionByKind.general;

    const detailLine = [
      'I do not want to guess on the wrong record.',
      currentPage ? `Current page: ${currentPage}` : null,
      recentSummary ? `Recent thread: ${recentSummary}` : null,
      lead ? `Active booking: ${lead.eventType} at ${lead.location ?? 'TBD'}` : null,
      project ? `Active project: ${project.status} at ${project.progress}% progress` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    return {
      content: buildAssistantResponseContent({
        style: 'clarification',
        summary,
        details: [detailLine],
      }),
      actions: this.buildClarificationActions(
        user,
        clarificationKind,
        lead,
        project,
        summary,
      ),
      metadata: {
        responseType: 'clarification',
        clarificationKind,
        confidence: classification?.confidence ?? null,
        pageKey: pageKey ?? null,
        matchedIntents: classification?.matchedIntents ?? [],
        recentThreadSummary: recentSummary ?? null,
        llmUnderstandingUsed: Boolean(understanding),
      },
    };
  }

  private buildClarificationNextActions(
    clarificationKind: string,
    lead: any | null,
    project: any | null,
  ) {
    const actions: string[] = [];

    if (clarificationKind === 'budget') {
      actions.push('Make it cheaper', 'Make it premium');
    } else if (clarificationKind === 'venue') {
      actions.push('Keep indoor setup', 'Move outdoors');
    } else if (clarificationKind === 'city') {
      actions.push('Change city', 'Keep current city');
    } else if (clarificationKind === 'payment') {
      actions.push('Show pending payments', 'Draft reminder');
    } else if (clarificationKind === 'contract') {
      actions.push('Open contract', 'Draft follow-up');
    } else if (clarificationKind === 'chat') {
      actions.push('Open unread chats', 'Draft reply');
    } else if (clarificationKind === 'assignment') {
      actions.push('Show who is handling', 'Open booking');
    } else if (clarificationKind === 'booking') {
      actions.push('Open booking', 'Share event type');
    } else {
      actions.push('Show current record', 'Contact team');
    }

    if (lead || project) {
      actions.push('Keep current record');
    }

    return actions.slice(0, 4);
  }

  private buildClarificationActions(
    user: AuthUser,
    clarificationKind: string,
    lead: any | null,
    project: any | null,
    summary: string,
  ): AssistantAction[] {
    const bookingHref = lead
      ? this.getLeadHref(user, lead.id)
      : project
        ? (this.getProjectHref(user, project.id, lead?.id) ??
          this.getCreateBookingHref(user))
        : this.getCreateBookingHref(user);
    const paymentHref = this.getPaymentsHref(
      user,
      lead?.id ?? null,
      project?.id ?? null,
    );
    const contractHref = this.getContractsHref(user, lead?.id ?? null);
    const chatHref = this.getChatHref(user);

    const primaryAction =
      clarificationKind === 'payment'
        ? createNavigateAssistantAction(
            'clarify-open-payment',
            'Open payment',
            paymentHref,
            'Jump to the current payment record.',
          )
        : clarificationKind === 'contract'
          ? createNavigateAssistantAction(
              'clarify-open-contract',
              'Open contract',
              contractHref,
              'Jump to the current contract record.',
            )
          : clarificationKind === 'chat'
            ? createNavigateAssistantAction(
                'clarify-open-chat',
                'Open chat',
                chatHref,
                'Jump to the current chat workspace.',
              )
            : createNavigateAssistantAction(
                'clarify-open-booking',
                lead || project ? 'Open booking' : 'Start booking',
                bookingHref,
                'Jump to the most relevant booking workspace.',
              );

    return dedupeAssistantActions([
      primaryAction,
      createDraftAssistantAction(
        'clarify-talk-team',
        'Draft clarification',
        `Please clarify: ${summary}`,
        'Draft a short note for the team with the clarification question.',
      ),
      createNavigateAssistantAction(
        'clarify-contact',
        user.role === Role.ADMIN ? 'Open chat' : 'Contact team',
        chatHref,
        'Open the team chat or support route for a human handoff.',
      ),
    ]);
  }

  private async maybeComposeAssistantTurn(input: {
    user: AuthUser;
    message: string;
    context: AssistantContextInput;
    history: AssistantHistoryEntry[];
    classification: AssistantClassification;
    memory: AssistantConversationMemory | null;
    entities: AssistantExtractedEntities;
    pageKey: string;
    section: string;
    turn: AssistantTurn;
    diagnostics?: AssistantPipelineDiagnostics | null;
  }): Promise<AssistantTurn> {
    const diagnostics =
      input.diagnostics?.composer ??
      createAssistantLlmCallDiagnostics({
        layer: 'composer',
        apiKeyPresent: this.llmComposer.isEnabled(),
        model: this.llmComposer.getModelName(),
        baseUrl: this.llmComposer.getBaseUrl(),
      });
    const skipReason = this.describeComposeSkipReason(input);

    if (skipReason) {
      diagnostics.called = false;
      diagnostics.source = 'deterministic';
      diagnostics.success = false;
      diagnostics.statusCode = null;
      diagnostics.durationMs = 0;
      diagnostics.fallbackReason = skipReason;
      diagnostics.deterministicFallbackUsed = true;
      diagnostics.error = null;
      return {
        ...input.turn,
        metadata: {
          ...input.turn.metadata,
          llmComposed: false,
          llmComposerDiagnostics: diagnostics,
        },
      };
    }

    diagnostics.called = true;
    diagnostics.source = 'llm';
    diagnostics.success = null;
    diagnostics.statusCode = null;
    diagnostics.fallbackReason = null;
    diagnostics.deterministicFallbackUsed = false;
    diagnostics.error = null;

    const responseStyle = this.resolveAssistantResponseStyle(input);

    const composed = await this.llmComposer.compose({
      userMessage: input.message,
      role: input.user.role,
      intent: input.classification.primaryIntent,
      matchedIntents: input.classification.matchedIntents,
      confidence:
        typeof input.classification.confidence === 'number'
          ? input.classification.confidence
          : null,
      responseType:
        typeof input.turn.metadata?.responseType === 'string'
          ? input.turn.metadata.responseType
          : null,
      responseStyle,
      pageKey: input.pageKey,
      section: input.section,
      pagePath: input.context.pagePath ?? null,
      pageTitle: input.context.pageTitle ?? null,
      contextMetadata: this.toObjectRecord(
        input.context.metadata as Prisma.JsonValue,
      ),
      memory: input.memory,
      entities: input.entities,
      history: input.history,
      allowedActions: input.turn.actions.map((action) => ({
        type: action.type,
        label: action.label,
        description: action.description,
        href: action.href,
      })),
      deterministicReply: input.turn.content,
      responseMetadata: this.toObjectRecord(
        input.turn.metadata as Prisma.JsonValue,
      ),
    }, diagnostics);

    if (!composed) {
      return {
        ...input.turn,
        metadata: {
          ...input.turn.metadata,
          llmComposed: false,
          llmComposerDiagnostics: diagnostics,
        },
      };
    }

    const summary =
      responseStyle === 'clarification'
        ? composed.clarificationQuestion.trim() || composed.summary.trim()
        : composed.summary.trim();

    if (!summary) {
      diagnostics.source = 'deterministic';
      diagnostics.success = false;
      diagnostics.durationMs = diagnostics.durationMs ?? 0;
      diagnostics.fallbackReason = 'empty_summary_after_compose';
      diagnostics.deterministicFallbackUsed = true;
      diagnostics.error = null;
      return {
        ...input.turn,
        metadata: {
          ...input.turn.metadata,
          llmComposed: false,
          llmComposerDiagnostics: diagnostics,
        },
      };
    }

    return {
      ...input.turn,
      content: buildAssistantResponseContent({
        style: responseStyle,
        summary,
        details: composed.details,
        nextActions: composed.nextActions,
      }),
      metadata: {
        ...input.turn.metadata,
        llmComposed: true,
        llmTone: composed.tone,
        llmModel: this.llmComposer.getModelName(),
        llmDraftContent: input.turn.content,
        llmClarificationQuestion:
          composed.clarificationQuestion.trim() || undefined,
        llmComposerDiagnostics: diagnostics,
      },
    };
  }

  private shouldComposeAssistantTurn(input: {
    user: AuthUser;
    message: string;
    classification: AssistantClassification;
    turn: AssistantTurn;
  }) {
    return this.describeComposeSkipReason(input) === null;
  }

  private describeComposeSkipReason(input: {
    user: AuthUser;
    message: string;
    classification: AssistantClassification;
    turn: AssistantTurn;
  }) {
    if (!this.llmComposer.isEnabled()) {
      return 'missing_api_key';
    }

    const responseStyle =
      typeof input.turn.metadata?.responseStyle === 'string'
        ? input.turn.metadata.responseStyle
        : null;

    if (
      responseStyle &&
      [
        'greeting',
        'identity',
        'capability',
        'direct_answer',
        'booking_recommendation',
        'clarification',
        'follow_up',
        'escalation',
        'unsupported_request',
      ].includes(responseStyle)
    ) {
      return null;
    }

    const responseType =
      typeof input.turn.metadata?.responseType === 'string'
        ? input.turn.metadata.responseType
        : null;

    if (!responseType) {
      return 'missing_response_type';
    }

    if (responseType === 'clarification' || responseType === 'fallback') {
      return null;
    }

    const confidence =
      typeof input.classification.confidence === 'number'
        ? input.classification.confidence
        : null;

    if (confidence !== null && confidence < 0.58) {
      return null;
    }

    if (
      this.isRoutineLookupMessage(input.message) &&
      (this.isRoutineLookupResponseType(responseType) ||
        responseType === 'next_step_help')
    ) {
      return 'routine_lookup';
    }

    return this.isComposableResponseType(responseType)
      ? null
      : 'response_type_not_composable';
  }

  private resolveAssistantResponseStyle(input: {
    message: string;
    context: AssistantContextInput;
    history: AssistantHistoryEntry[];
    classification: AssistantClassification;
    memory: AssistantConversationMemory | null;
    entities: AssistantExtractedEntities;
    pageKey: string;
    section: string;
    turn: AssistantTurn;
  }): AssistantResponseStyle {
    const existingStyle =
      isAssistantResponseStyle(input.turn.metadata?.responseStyle)
        ? input.turn.metadata.responseStyle
        : null;

    if (existingStyle) {
      return existingStyle;
    }

    return classifyAssistantResponseStyle({
      message: input.message,
      classification: input.classification,
      responseType:
        typeof input.turn.metadata?.responseType === 'string'
          ? input.turn.metadata.responseType
          : null,
      memory: input.memory,
      entities: input.entities,
      pageKey: input.pageKey,
      section: input.section,
    });
  }

  private annotateAssistantTurnStyle(input: {
    user: AuthUser;
    message: string;
    context: AssistantContextInput;
    history: AssistantHistoryEntry[];
    classification: AssistantClassification;
    memory: AssistantConversationMemory | null;
    entities: AssistantExtractedEntities;
    pageKey: string;
    section: string;
    turn: AssistantTurn;
  }): AssistantTurn {
    const responseStyle = this.resolveAssistantResponseStyle(input);
    const responseStyleConfig = getResponseStyleConfig(responseStyle);

    return {
      ...input.turn,
      metadata: {
        ...input.turn.metadata,
        responseStyle,
        responseTone: responseStyleConfig.tone,
        responseLength: responseStyleConfig.length,
        responseChipStyle: responseStyleConfig.chipStyle,
        responseFormat: responseStyleConfig.format,
      },
    };
  }

  private isRoutineLookupMessage(message: string) {
    const normalized = message.toLowerCase().trim();

    return this.includesAny(normalized, [
      'show overdue payments',
      'show unread chats',
      'show unread chat',
      'open contract',
      'open booking',
      'open payment',
      'open payments',
      'show payments',
      'show contracts',
      'show bookings',
      'what is pending',
      "what's pending",
      'what is pending here',
      "what's pending here",
      'what is left to pay',
      'what is still left to pay',
      'how much is still left to pay',
      'show pending tasks',
      'show current booking',
      'open chat',
      'show payment status',
    ]);
  }

  private isRoutineLookupResponseType(responseType: string) {
    return [
      'payments_summary',
      'contract_summary',
      'unread_chat_summary',
      'pending_summary',
      'entity_summary',
    ].includes(responseType);
  }

  private isComposableResponseType(responseType: string) {
    return [
      'booking_consultation',
      'booking_refinement',
      'dashboard_snapshot',
      'page_overview',
      'next_step_help',
      'draft_preview',
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
      'escalation',
    ].includes(responseType);
  }

  private buildRecentThreadSummary(history: AssistantHistoryEntry[]) {
    const recent = history.slice(-4);
    if (!recent.length) {
      return null;
    }

    return recent
      .map((entry) => {
        const actor = entry.actor.toLowerCase();
        const content = entry.content.trim().replace(/\s+/g, ' ');
        return `${actor}: ${content.slice(0, 80)}`;
      })
      .join(' | ');
  }

  private resolveClarificationKind(
    message: string,
    classification?: AssistantClassification | null,
    memory?: AssistantConversationMemory | null,
  ) {
    const normalized = message.toLowerCase();
    const paymentSignal =
      this.isPaymentsIntent(normalized) ||
      this.isPendingIntent(normalized) ||
      this.isPaymentReminderIntent(normalized) ||
      /\b(payment|invoice|due|balance|remaining|owed|outstanding|milestone)\b/.test(
        normalized,
      );
    const contractSignal =
      this.isContractsIntent(normalized) ||
      /\b(contract|agreement|signature|signed|paperwork)\b/.test(normalized);
    const chatSignal =
      this.isUnreadChatsIntent(normalized) ||
      /\b(chat|message|reply|inbox|thread|conversation|unread|silent|ghosting|not replying)\b/.test(
        normalized,
      );
    const assignmentSignal =
      this.isAssignmentsIntent(normalized) ||
      /\b(who is handling|who handles|who owns|assigned person|handler|coordinator|responsible)\b/.test(
        normalized,
      );
    const budgetSignal =
      /\b(cheap|cheaper|budget|cost|price|pricing|lakh|affordable|premium|expensive|costly)\b/.test(
        normalized,
      ) || Boolean(memory?.budgetPreference);
    const venueSignal =
      /\b(indoor|indoors|outdoor|outdoors|outside venue|move outdoors|keep it indoor|keep it outdoors)\b/.test(
        normalized,
      ) ||
      /\b(city|hyderabad|bangalore|bengaluru|mumbai|delhi|pune|chennai|goa)\b/.test(
        normalized,
      );
    const bookingSignal =
      /\b(booking|event|party|project|brief|setup)\b/.test(normalized) ||
      Boolean(memory?.selectedBookingId || memory?.selectedProjectId);

    if (paymentSignal) return 'payment';
    if (contractSignal) return 'contract';
    if (chatSignal) return 'chat';
    if (assignmentSignal) return 'assignment';
    if (budgetSignal) return 'budget';
    if (venueSignal)
      return /\b(city|hyderabad|bangalore|bengaluru|mumbai|delhi|pune|chennai|goa)\b/.test(
        normalized,
      )
        ? 'city'
        : 'venue';
    if (bookingSignal) return 'booking';

    if (memory?.lastPrimaryIntent === 'payment_help') return 'payment';
    if (memory?.lastPrimaryIntent === 'contract_help') return 'contract';
    if (memory?.lastPrimaryIntent === 'unread_messages_help') return 'chat';
    if (memory?.lastPrimaryIntent === 'assignments_help') return 'assignment';
    if (memory?.lastPrimaryIntent === 'budget_discussion') return 'budget';
    if (
      memory?.lastPrimaryIntent === 'booking_inquiry' ||
      memory?.lastPrimaryIntent === 'booking_follow_up' ||
      memory?.lastPrimaryIntent === 'service_recommendation'
    ) {
      return 'booking';
    }

    if (classification?.matchedIntents.includes('payment_help'))
      return 'payment';
    if (classification?.matchedIntents.includes('contract_help'))
      return 'contract';
    if (classification?.matchedIntents.includes('unread_messages_help'))
      return 'chat';
    if (classification?.matchedIntents.includes('assignments_help'))
      return 'assignment';
    if (classification?.matchedIntents.includes('budget_discussion'))
      return 'budget';
    if (
      classification?.matchedIntents.includes('booking_inquiry') ||
      classification?.matchedIntents.includes('booking_follow_up') ||
      classification?.matchedIntents.includes('service_recommendation')
    ) {
      return 'booking';
    }

    return 'general';
  }

  private buildEntityActions(
    user: AuthUser,
    lead: any | null,
    project: any | null,
    options?: { includePayments?: boolean },
  ): AssistantAction[] {
    const actions: AssistantAction[] = [];

    if (lead) {
      actions.push(
        createNavigateAssistantAction(
          `lead-${lead.id}`,
          'Open booking',
          this.getLeadHref(user, lead.id),
          'Jump into the booking workspace.',
        ),
      );
    }

    if (project) {
      const projectHref = this.getProjectHref(user, project.id, lead?.id);

      if (projectHref) {
        actions.push(
          createNavigateAssistantAction(
            `project-${project.id}`,
            'Open project',
            projectHref,
            'Open the linked project workspace.',
          ),
        );
      }
    }

    if (options?.includePayments) {
      actions.push(
        createNavigateAssistantAction(
          'payments-view',
          'View payments',
          this.getPaymentsHref(user, lead?.id, project?.id),
          'Open the most relevant payment view.',
        ),
      );
    }

    return dedupeAssistantActions(actions).slice(0, 3);
  }

  private async getLeadFromContext(
    user: AuthUser,
    context: AssistantContextInput,
  ) {
    const leadId = context.leadId ?? context.bookingId;

    if (!leadId) {
      return null;
    }

    return this.prisma.lead.findFirst({
      where: {
        id: leadId,
        ...this.buildLeadAccessWhere(user),
      },
      include: assistantLeadInclude,
    });
  }

  private async getProjectFromContext(
    user: AuthUser,
    context: AssistantContextInput,
    lead?: any | null,
  ) {
    const explicitProjectId =
      context.projectId ?? lead?.proposals?.[0]?.contract?.project?.id ?? null;

    if (!explicitProjectId) {
      return null;
    }

    return this.prisma.project.findFirst({
      where: {
        id: explicitProjectId,
        ...this.buildProjectAccessWhere(user),
      },
      include: assistantProjectInclude,
    });
  }

  private buildLeadAccessWhere(user: AuthUser): Prisma.LeadWhereInput {
    switch (user.role) {
      case Role.CLIENT:
        return {
          deletedAt: null,
          clientId: user.userId,
        };
      case Role.ADMIN:
        return {
          deletedAt: null,
        };
      case Role.VENDOR:
        return {
          deletedAt: null,
          proposals: {
            some: {
              contract: {
                is: {
                  project: {
                    is: {
                      vendors: {
                        some: {
                          vendor: {
                            is: {
                              userId: user.userId,
                              deletedAt: null,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        };
      default:
        return {
          deletedAt: null,
          assignments: {
            some: {
              userId: user.userId,
              isActive: true,
            },
          },
        };
    }
  }

  private buildProjectAccessWhere(user: AuthUser): Prisma.ProjectWhereInput {
    switch (user.role) {
      case Role.CLIENT:
        return {
          deletedAt: null,
          clientId: user.userId,
        };
      case Role.ADMIN:
        return {
          deletedAt: null,
        };
      case Role.VENDOR:
        return {
          deletedAt: null,
          vendors: {
            some: {
              vendor: {
                is: {
                  userId: user.userId,
                  deletedAt: null,
                },
              },
            },
          },
        };
      default:
        return {
          deletedAt: null,
          assignments: {
            some: {
              userId: user.userId,
              isActive: true,
            },
          },
        };
    }
  }

  private buildPaymentAccessWhere(user: AuthUser): Prisma.PaymentWhereInput {
    return {
      project: this.buildProjectAccessWhere(user),
    };
  }

  private buildContractAccessWhere(user: AuthUser): Prisma.ContractWhereInput {
    switch (user.role) {
      case Role.CLIENT:
        return {
          proposal: {
            lead: {
              clientId: user.userId,
              deletedAt: null,
            },
          },
        };
      case Role.ADMIN:
        return {};
      case Role.VENDOR:
        return {
          project: this.buildProjectAccessWhere(user),
        };
      default:
        return {
          OR: [
            {
              proposal: {
                lead: {
                  deletedAt: null,
                  assignments: {
                    some: {
                      userId: user.userId,
                      isActive: true,
                    },
                  },
                },
              },
            },
            {
              project: this.buildProjectAccessWhere(user),
            },
          ],
        };
    }
  }

  private buildProposalAccessWhere(user: AuthUser): Prisma.ProposalWhereInput {
    switch (user.role) {
      case Role.CLIENT:
        return {
          lead: {
            clientId: user.userId,
            deletedAt: null,
          },
        };
      case Role.ADMIN:
        return {};
      case Role.VENDOR:
        return {
          contract: {
            project: this.buildProjectAccessWhere(user),
          },
        };
      default:
        return {
          lead: {
            deletedAt: null,
            assignments: {
              some: {
                userId: user.userId,
                isActive: true,
              },
            },
          },
        };
    }
  }

  private getVisibleOpenTasks(user: AuthUser, project: any | null) {
    if (!project?.tasks?.length) {
      return [];
    }

    return project.tasks.filter((task: any) => {
      if (task.status === ProjectTaskStatus.DONE) {
        return false;
      }

      if (user.role === Role.VENDOR) {
        return task.assignedVendor?.userId === user.userId;
      }

      return true;
    });
  }

  private ensureConversation(userId: string, conversationId: string) {
    return this.prisma.aiConversation
      .findFirst({
        where: {
          id: conversationId,
          userId,
          deletedAt: null,
        },
        include: assistantConversationInclude,
      })
      .then((conversation) => {
        if (!conversation) {
          throw new NotFoundException('Conversation not found.');
        }

        return conversation;
      });
  }

  private serializeConversation(
    conversation: any,
  ): AssistantSerializedConversation {
    return {
      id: conversation.id,
      title: conversation.title,
      preview: conversation.messages?.[0]?.content ?? null,
      messageCount: conversation._count?.messages ?? 0,
      isArchived: Boolean(conversation.isArchived),
      archivedAt: conversation.archivedAt
        ? conversation.archivedAt.toISOString()
        : null,
      isPinned: Boolean(conversation.isPinned),
      pinnedAt: conversation.pinnedAt
        ? conversation.pinnedAt.toISOString()
        : null,
      pagePath: conversation.contexts?.[0]?.pagePath ?? null,
      pageTitle: conversation.contexts?.[0]?.pageTitle ?? null,
      lastMessageAt: conversation.lastMessageAt
        ? conversation.lastMessageAt.toISOString()
        : null,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  private serializeMessage(message: any): AssistantSerializedMessage {
    const metadata = this.toObjectRecord(message.metadata);

    return {
      id: message.id,
      actor: message.actor,
      role: message.role ?? null,
      content: message.content,
      actions: Array.isArray(metadata?.actions)
        ? (metadata.actions as AssistantAction[])
        : [],
      metadata,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private createTransientMessage(input: {
    id: string;
    actor: AiMessageActor;
    role: Role;
    content: string;
    createdAt: Date;
    actions?: AssistantAction[];
    metadata?: Record<string, unknown>;
  }): AssistantSerializedMessage {
    return {
      id: input.id,
      actor: input.actor,
      role: input.role,
      content: input.content,
      actions: input.actions ?? [],
      metadata: input.metadata ?? null,
      createdAt: input.createdAt.toISOString(),
    };
  }

  private async logAssistantEvent(
    user: AuthUser,
    input: {
      eventType: string;
      conversationId?: string;
      messageId?: string;
      pageKey?: string;
      section?: string;
      intent?: string;
      label?: string;
      contentSnippet?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    try {
      await this.prisma.aiAssistantEvent.create({
        data: {
          userId: user.userId,
          conversationId: input.conversationId,
          messageId: input.messageId,
          role: user.role,
          eventType: input.eventType,
          pageKey: input.pageKey,
          section: input.section,
          intent: input.intent,
          label: input.label,
          contentSnippet: input.contentSnippet?.slice(0, 240),
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch {
      // Analytics should never block assistant replies.
    }
  }

  private normalizeContext(
    input?: AssistantContextInput,
    previous?: AssistantContextInput,
  ): AssistantContextInput {
    const leadId =
      input?.leadId ??
      input?.bookingId ??
      previous?.leadId ??
      previous?.bookingId;
    const bookingId =
      input?.bookingId ?? leadId ?? previous?.bookingId ?? previous?.leadId;

    return {
      pagePath: input?.pagePath ?? previous?.pagePath,
      pageTitle: input?.pageTitle ?? previous?.pageTitle,
      bookingId,
      leadId,
      projectId: input?.projectId ?? previous?.projectId,
      metadata: {
        ...(previous?.metadata ?? {}),
        ...(input?.metadata ?? {}),
      },
    };
  }

  private buildContextCreateInput(role: Role, input: AssistantContextInput) {
    return {
      userRole: role,
      pagePath: input.pagePath,
      pageTitle: input.pageTitle,
      bookingId: input.bookingId ?? input.leadId,
      leadId: input.leadId ?? input.bookingId,
      projectId: input.projectId,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    };
  }

  private contextRecordToInput(record: any): AssistantContextInput {
    return {
      pagePath: record.pagePath ?? undefined,
      pageTitle: record.pageTitle ?? undefined,
      bookingId: record.bookingId ?? undefined,
      leadId: record.leadId ?? undefined,
      projectId: record.projectId ?? undefined,
      metadata: this.toObjectRecord(record.metadata) ?? undefined,
    };
  }

  private hasContextValue(input: AssistantContextInput) {
    return Boolean(
      input.pagePath ||
      input.pageTitle ||
      input.bookingId ||
      input.leadId ||
      input.projectId ||
      (input.metadata && Object.keys(input.metadata).length),
    );
  }

  private getContextSection(context: AssistantContextInput) {
    return typeof context.metadata?.section === 'string'
      ? context.metadata.section
      : 'general';
  }

  private getConversationHistory(
    context: AssistantContextInput,
  ): AssistantHistoryEntry[] {
    const rawHistory = context.metadata?.history;

    if (!Array.isArray(rawHistory)) {
      return [];
    }

    return rawHistory
      .map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          return null;
        }

        const actor =
          typeof entry.actor === 'string' ? entry.actor.toUpperCase() : null;
        const content =
          typeof entry.content === 'string' ? entry.content.trim() : '';

        if (!actor || !content) {
          return null;
        }

        if (actor !== 'USER' && actor !== 'ASSISTANT' && actor !== 'SYSTEM') {
          return null;
        }

        return {
          actor: actor as AssistantHistoryEntry['actor'],
          content,
        };
      })
      .filter(Boolean) as AssistantHistoryEntry[];
  }

  private classifyIntent(
    input: string,
    context: AssistantContextInput,
    history: AssistantHistoryEntry[],
    memory: AssistantConversationMemory,
  ): AssistantIntent[] {
    const intents = new Set<AssistantIntent>();

    if (/^(hi|hello|hey|yo)\b/.test(input.trim())) {
      intents.add('greeting');
    }

    if (
      this.isPageAboutIntent(input) ||
      /\b(what|how|why|when)\b/.test(input)
    ) {
      intents.add('informational_question');
    }

    if (
      this.isCreateBookingIntent(input) ||
      this.isBookingFollowUpIntent(input, history)
    ) {
      intents.add('booking_inquiry');
    }

    if (
      memory.guestCount ||
      memory.budgetAmount ||
      memory.occasion ||
      memory.eventType ||
      memory.venueType
    ) {
      intents.add('booking_inquiry');
    }

    if (
      /\b(recommend|best fit|which service|fit)\b/.test(input) ||
      (memory.serviceSlug &&
        (memory.guestCount ||
          memory.budgetAmount ||
          memory.occasion ||
          memory.eventType ||
          memory.venueType))
    ) {
      intents.add('service_recommendation');
    }

    if (
      /\b(price|pricing|budget|cost|quote|lakh|₹)\b/.test(input) ||
      memory.budgetAmount
    ) {
      intents.add('budget_discussion');
    }

    if (/\b(open|take me|show me|go to|navigate)\b/.test(input)) {
      intents.add('navigation_request');
    }

    if (/\b(help|issue|problem|stuck)\b/.test(input)) {
      intents.add('action_request');
    }

    if (this.isSupportEscalationIntent(input)) {
      intents.add('support_escalation');
    }

    if (
      !intents.size &&
      ['bookings', 'projects'].includes(this.getContextSection(context))
    ) {
      intents.add('booking_inquiry');
    }

    return Array.from(intents);
  }

  private getLastHistoryMessage(
    history: AssistantHistoryEntry[],
    actor: AssistantHistoryEntry['actor'],
  ) {
    return (
      [...history].reverse().find((entry) => entry.actor === actor) ?? null
    );
  }

  private resolveRequestedServiceSlug(
    input: string,
    context?: AssistantContextInput,
  ) {
    const normalized = input.toLowerCase();
    const mapping = [
      {
        slug: 'martini',
        terms: [
          'martini',
          'house party',
          'house-party',
          'houseparty',
          'private celebration',
          'private party',
          'private event',
          'private gathering',
          'friends party',
          'party with friends',
          'friends gathering',
          'friends get together',
          'friends celebration',
          'college friends',
          'friends meetup',
          'couples event',
          'couples celebration',
          'date night',
          'romantic dinner',
          'anniversary party',
          'anniversary celebration',
          'bachelor party',
          'bachelorette party',
          'intimate event',
          'intimate gathering',
          'private dinner',
        ],
      },
      {
        slug: 'negroni',
        terms: ['negroni', 'pool party', 'pool-party', 'poolparty'],
      },
      {
        slug: 'corporate',
        terms: ['corporate', 'corporate event', 'corporate-events', 'cosmo'],
      },
      {
        slug: 'festival',
        terms: ['festival', 'bloody mary', 'bloody-mary', 'bm'],
      },
    ].find((service) =>
      service.terms.some((term) => normalized.includes(term)),
    );

    if (mapping) {
      return mapping.slug;
    }

    return typeof context?.metadata?.serviceSlug === 'string'
      ? context.metadata.serviceSlug
      : null;
  }

  private parseBudgetAmount(input: string) {
    const normalized = input.toLowerCase();

    if (/\b(a|one)\s+lakh\b/.test(normalized)) {
      return 100000;
    }

    const lakhMatch = normalized.match(/(?:₹\s*)?(\d+(?:\.\d+)?)\s*lakh\b/);
    if (lakhMatch) {
      return Math.round(Number(lakhMatch[1]) * 100000);
    }

    const thousandMatch = normalized.match(/(?:₹\s*)?(\d+(?:\.\d+)?)\s*k\b/);
    if (thousandMatch) {
      return Math.round(Number(thousandMatch[1]) * 1000);
    }

    const rupeeMatch = normalized.match(/₹?\s*([\d,]{4,9})\b/);
    if (rupeeMatch) {
      const digits = Number(rupeeMatch[1].replace(/,/g, ''));
      return Number.isNaN(digits) ? null : digits;
    }

    return null;
  }

  private parseGuestCount(input: string) {
    const match = input
      .toLowerCase()
      .match(/\b(\d{1,4})\s*(guest|guests|people|pax|persons)\b/);

    return match ? Number(match[1]) : null;
  }

  private parseOccasion(input: string) {
    const normalized = input.toLowerCase();
    const occasions = [
      'ugadi',
      'diwali',
      'holi',
      'christmas',
      'birthday',
      'anniversary',
      'wedding',
      'reception',
      'engagement',
      'launch',
      'mixer',
      'festival',
      'office party',
      'corporate event',
    ];

    const found = occasions.find((occasion) => normalized.includes(occasion));
    return found
      ? found.replace(/\b\w/g, (character) => character.toUpperCase())
      : null;
  }

  private inferEventType(input: string) {
    const normalized = input.toLowerCase();

    if (/\b(office|corporate|team|work|workplace|company)\b/.test(normalized)) {
      return 'office event';
    }

    if (/\b(home|house|private)\b/.test(normalized)) {
      return 'house event';
    }

    if (/\b(pool|poolside)\b/.test(normalized)) {
      return 'pool event';
    }

    if (/\b(festival|public|concert|crowd)\b/.test(normalized)) {
      return 'festival event';
    }

    return null;
  }

  private inferVenueHint(input: string) {
    const normalized = input.toLowerCase();

    if (normalized.includes('office')) return 'office';
    if (normalized.includes('home') || normalized.includes('house'))
      return 'home';
    if (normalized.includes('pool')) return 'pool';
    if (normalized.includes('hotel')) return 'hotel';
    if (normalized.includes('outdoor')) return 'outdoor venue';

    return null;
  }

  private parseLocation(input: string) {
    const match = input.match(
      /\b(?:in|at)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\b/,
    );

    return match?.[1] ?? null;
  }

  private parseIndoorOutdoor(input: string) {
    const normalized = input.toLowerCase();
    if (normalized.includes('indoor')) return 'indoor';
    if (normalized.includes('outdoor')) return 'outdoor';
    return null;
  }

  private inferServiceFromBrief(
    input: string,
    fallbackServiceSlug?: string | null,
  ) {
    const resolvedFromText = this.resolveRequestedServiceSlug(input);
    if (resolvedFromText) {
      return resolvedFromText;
    }

    const normalized = input.toLowerCase();

    if (
      /\b(private celebration|private party|private event|private gathering|friends party|party with friends|friends gathering|friends get together|friends celebration|college friends|friends meetup|couples event|couples celebration|date night|romantic dinner|anniversary party|anniversary celebration|bachelor party|bachelorette party|intimate event|intimate gathering|private dinner)\b/.test(
        normalized,
      )
    ) {
      return 'martini';
    }

    if (/\b(office|corporate|team|work|company)\b/.test(normalized)) {
      return 'corporate';
    }

    if (/\b(home|house|private)\b/.test(normalized)) {
      return 'martini';
    }

    if (/\b(pool|poolside)\b/.test(normalized)) {
      return 'negroni';
    }

    if (/\b(festival|public|concert|crowd)\b/.test(normalized)) {
      return 'festival';
    }

    return fallbackServiceSlug ?? null;
  }

  private extractBookingMemory(
    input: string,
    context: AssistantContextInput,
    history: AssistantHistoryEntry[],
    entities: AssistantExtractedEntities,
    previousMemory?: AssistantConversationMemory | null,
  ): AssistantBookingInsight {
    const transcript = [...history.map((entry) => entry.content), input].join(
      ' ',
    );
    const serviceSlug =
      entities.serviceSlug ??
      this.inferServiceFromBrief(
        transcript,
        this.resolveRequestedServiceSlug('', context) ??
          previousMemory?.serviceSlug ??
          (typeof previousMemory?.serviceRecommendation === 'string'
            ? previousMemory.serviceRecommendation
            : null),
      );
    const budgetAmount =
      entities.budgetAmount ?? this.parseBudgetAmount(transcript) ?? undefined;
    const guestCount =
      entities.guestCount ?? this.parseGuestCount(transcript) ?? undefined;
    const city = entities.city ?? previousMemory?.city ?? undefined;
    const location =
      entities.location ?? city ?? previousMemory?.location ?? undefined;
    const indoorOutdoor =
      entities.indoorOutdoor ?? previousMemory?.indoorOutdoor ?? undefined;
    const occasion = entities.occasion ?? previousMemory?.occasion ?? undefined;
    const eventType =
      entities.eventType ?? previousMemory?.eventType ?? undefined;
    const venueType =
      entities.venueType ?? previousMemory?.venueType ?? undefined;
    const foodRequirement =
      entities.foodRequirement ?? previousMemory?.foodRequirement;
    const drinkRequirement =
      entities.drinkRequirement ?? previousMemory?.drinkRequirement;
    const budgetPreference =
      entities.budgetPreference ?? previousMemory?.budgetPreference;
    const hasDate =
      /\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)|tomorrow|next week|next month|\d{4}-\d{2}-\d{2})\b/i.test(
        transcript,
      );

    return {
      occasion,
      eventType,
      serviceSlug,
      meaningfulTurns: previousMemory?.meaningfulTurns ?? 0,
      guestCount: guestCount ?? previousMemory?.guestCount,
      budgetAmount: budgetAmount ?? previousMemory?.budgetAmount,
      budgetText: budgetAmount
        ? this.formatCurrency(budgetAmount)
        : previousMemory?.budgetText,
      budgetPreference,
      city,
      location,
      venueType,
      indoorOutdoor,
      foodRequirement,
      drinkRequirement,
      likelyInclusions: this.getLikelyInclusions(serviceSlug),
      missingDetails: [
        city || location ? null : 'city/location',
        hasDate ? null : 'date',
        indoorOutdoor ? null : 'indoor or outdoor',
        foodRequirement ? null : 'whether you need food service as well',
        drinkRequirement ? null : 'whether you want alcohol or a dry setup',
      ].filter(Boolean) as string[],
    };
  }

  private getLikelyInclusions(serviceSlug?: string | null) {
    if (serviceSlug === 'corporate') {
      return [
        'bartender service',
        'drinks setup',
        'menu planning',
        'custom drink options',
      ];
    }

    if (serviceSlug === 'martini') {
      return [
        'bartender service',
        'home bar setup',
        'signature cocktails',
        'glassware support',
      ];
    }

    if (serviceSlug === 'negroni') {
      return [
        'poolside drinks setup',
        'bartender service',
        'summer menu planning',
        'guest service support',
      ];
    }

    if (serviceSlug === 'festival') {
      return [
        'bar stations',
        'fast service team',
        'menu planning',
        'operations support',
      ];
    }

    return ['bartender service', 'drinks setup', 'menu planning'];
  }

  private describeBudgetFit(memory: AssistantBookingInsight) {
    if (!memory.budgetAmount || !memory.guestCount) {
      return null;
    }

    const perGuestBudget = memory.budgetAmount / memory.guestCount;
    const baselineByService: Record<string, number> = {
      martini: 1000,
      corporate: 1200,
      negroni: 1300,
      festival: 1800,
    };
    const baseline = baselineByService[memory.serviceSlug ?? 'martini'] ?? 1200;

    if (perGuestBudget >= baseline * 1.8) {
      return `${memory.budgetText} is a comfortable range for ${memory.guestCount} guests.`;
    }

    if (perGuestBudget >= baseline) {
      return `${memory.budgetText} looks reasonable for ${memory.guestCount} guests.`;
    }

    return `${memory.budgetText} may be a little tight for ${memory.guestCount} guests unless we keep the setup lean.`;
  }

  private getServiceLabel(serviceSlug?: string | null) {
    if (serviceSlug === 'martini') return 'Private celebration';
    if (serviceSlug === 'negroni') return 'Pool party';
    if (serviceSlug === 'corporate') return 'Corporate event';
    if (serviceSlug === 'festival') return 'Festival event';
    return null;
  }

  private looksLikeBookingDetail(input: string) {
    return (
      /\b(guest|guests|people|venue|date|budget|price|snacks|indoor|outdoor|city|location)\b/.test(
        input,
      ) || /\b\d{1,4}\b/.test(input)
    );
  }

  private derivePageKey(role: Role, pagePath?: string) {
    const path = pagePath ?? '';

    if (path.includes('/dashboard/events/')) return 'client-event-detail';
    if (path.includes('/dashboard/bookings')) return 'client-bookings';
    if (path.includes('/admin/bookings/')) return 'admin-booking-detail';
    if (path.includes('/admin/bookings')) return 'admin-bookings';
    if (path.includes('/staff/projects/')) return 'staff-project-detail';
    if (path.includes('/staff/bookings/')) return 'staff-booking-detail';
    if (path.includes('/vendor/projects/')) return 'vendor-project-detail';

    if (role === Role.CLIENT) return 'general';
    if (role === Role.VENDOR) return 'general';
    if (role === Role.ADMIN) return 'general';
    return 'general';
  }

  private generateConversationTitle(input: string) {
    const compact = input.trim().replace(/\s+/g, ' ');
    if (!compact) {
      return 'Beer the Bear';
    }

    return compact.length > 48 ? `${compact.slice(0, 45)}...` : compact;
  }

  private getCreateBookingHref(user: AuthUser, serviceSlug?: string | null) {
    if (user.role === Role.CLIENT) {
      return serviceSlug ? `/booking?service=${serviceSlug}` : '/booking';
    }

    if (user.role === Role.ADMIN) {
      return '/admin/bookings/new';
    }

    return '/staff/bookings';
  }

  private getLeadHref(user: AuthUser, leadId: string) {
    if (user.role === Role.CLIENT) {
      return `/dashboard/events/${leadId}`;
    }

    if (user.role === Role.ADMIN) {
      return `/admin/bookings/${leadId}`;
    }

    if (user.role === Role.VENDOR) {
      return '/vendor';
    }

    return `/staff/bookings/${leadId}`;
  }

  private getProjectHref(
    user: AuthUser,
    projectId: string,
    leadId?: string | null,
  ) {
    if (user.role === Role.CLIENT) {
      return leadId ? `/dashboard/events/${leadId}` : '/dashboard/bookings';
    }

    if (user.role === Role.ADMIN) {
      return '/admin/projects';
    }

    if (user.role === Role.VENDOR) {
      return `/vendor/projects/${projectId}`;
    }

    return `/staff/projects/${projectId}`;
  }

  private getPaymentsHref(
    user: AuthUser,
    leadId?: string | null,
    projectId?: string | null,
  ) {
    if (user.role === Role.CLIENT) {
      return leadId ? `/dashboard/events/${leadId}` : '/dashboard/bookings';
    }

    if (user.role === Role.ADMIN) {
      return '/admin/payments';
    }

    if (user.role === Role.VENDOR) {
      return projectId ? `/vendor/projects/${projectId}` : '/vendor';
    }

    return '/staff/payments';
  }

  private getContractsHref(user: AuthUser, leadId?: string | null) {
    if (user.role === Role.CLIENT) {
      return leadId ? `/dashboard/events/${leadId}` : '/dashboard/bookings';
    }

    if (user.role === Role.ADMIN) {
      return '/admin/contracts';
    }

    if (user.role === Role.VENDOR) {
      return '/vendor';
    }

    return '/staff/bookings';
  }

  private getTasksHref(user: AuthUser) {
    if (user.role === Role.ADMIN) {
      return '/admin/projects';
    }

    if (user.role === Role.CLIENT) {
      return '/dashboard/bookings';
    }

    if (user.role === Role.VENDOR) {
      return '/vendor';
    }

    return '/staff/tasks';
  }

  private getChatHref(user: AuthUser) {
    if (user.role === Role.CLIENT) return '/dashboard/chat';
    if (user.role === Role.ADMIN) return '/admin/chat';
    if (user.role === Role.VENDOR) return '/vendor';
    return '/staff/chat';
  }

  private getNotificationsHref(user: AuthUser) {
    if (user.role === Role.ADMIN) {
      return '/admin/notifications';
    }

    if (
      user.role === Role.SALES ||
      user.role === Role.OPS ||
      user.role === Role.FINANCE
    ) {
      return '/staff/notifications';
    }

    if (user.role === Role.CLIENT) {
      return '/dashboard';
    }

    return '/vendor';
  }

  private buildAdaptivePromptSuggestions(
    user: AuthUser,
    pageKey: string,
    context: AssistantContextInput,
    telemetryEvents: Array<{
      eventType: string;
      intent?: string | null;
      label?: string | null;
      contentSnippet?: string | null;
      metadata?: Prisma.JsonValue | null;
      pageKey?: string | null;
    }>,
    telemetryWeights: Map<string, number>,
  ): AssistantPromptSuggestion[] {
    const suggestions: AssistantPromptSuggestion[] = [];
    const metadata = context.metadata ?? {};
    const section = deriveAssistantSection(context);
    const currentView =
      typeof metadata.currentView === 'string' ? metadata.currentView : '';
    const searchTerm =
      typeof metadata.searchTerm === 'string' ? metadata.searchTerm.trim() : '';
    const unreadNotifications =
      typeof metadata.unreadNotificationCount === 'number'
        ? metadata.unreadNotificationCount
        : 0;
    const unreadChats =
      typeof metadata.unreadChatCount === 'number'
        ? metadata.unreadChatCount
        : 0;
    const overduePayments =
      typeof metadata.overduePaymentCount === 'number'
        ? metadata.overduePaymentCount
        : 0;
    const unsignedContracts =
      typeof metadata.unsignedContractCount === 'number'
        ? metadata.unsignedContractCount
        : 0;
    const pendingTasks =
      typeof metadata.pendingTaskCount === 'number'
        ? metadata.pendingTaskCount
        : 0;
    const blockedBookings =
      typeof metadata.blockedBookingCount === 'number'
        ? metadata.blockedBookingCount
        : 0;
    const recentActionLabels =
      Array.isArray(metadata.recentActionLabels) &&
      metadata.recentActionLabels.every((label) => typeof label === 'string')
        ? metadata.recentActionLabels
        : [];
    const addSuggestion = (
      id: string,
      title: string,
      prompt: string,
      description: string,
    ) => {
      if (suggestions.some((suggestion) => suggestion.prompt === prompt)) {
        return;
      }

      suggestions.push({
        id,
        title,
        prompt,
        description,
      });
    };
    const telemetryWeightFor = (terms: string[]) =>
      terms.reduce((sum, term) => sum + (telemetryWeights.get(term) ?? 0), 0);
    const hasTelemetrySignal = (terms: string[], minimum = 6) =>
      telemetryWeightFor(terms) >= minimum;

    if (searchTerm) {
      addSuggestion(
        'context-search-term',
        'Use search term',
        `Find ${searchTerm}`,
        'Use the current search term to jump to matching records.',
      );
    }

    if (unreadNotifications > 0) {
      addSuggestion(
        'context-unread-notifications',
        'What needs attention?',
        'What needs attention?',
        'Surface unread notifications and the items most likely to need movement.',
      );
    }

    if (recentActionLabels.length > 0) {
      addSuggestion(
        'context-recent-action',
        'Recent action',
        recentActionLabels[0],
        'Resume the last action that was used on this page.',
      );
    }

    if (pageKey === 'admin-bookings' || pageKey === 'admin-booking-detail') {
      addSuggestion(
        'context-admin-booking-overdue',
        'Show overdue payments',
        'Show overdue payments',
        'Surface the bookings with overdue collection risk first.',
      );
      addSuggestion(
        'context-admin-booking-reminder',
        'Draft reminder',
        'Draft a payment reminder',
        'Generate a clean payment reminder for the booking in focus.',
      );
      addSuggestion(
        'context-admin-booking-staff',
        'Show missing staff',
        'Show missing staff',
        'Surface bookings that still need staffing coverage.',
      );
      addSuggestion(
        'context-admin-booking-chats',
        'Summarize unread chats',
        'Summarize unread chats',
        'Condense unread client chats for the current booking queue.',
      );
    }

    if (pageKey === 'admin-payments') {
      addSuggestion(
        'context-admin-payments-overdue',
        'Show overdue invoices',
        'Show overdue invoices',
        'Surface the invoices or milestones that need collection first.',
      );
      addSuggestion(
        'context-admin-payments-history',
        'Summarize payment history',
        'Summarize payment history',
        'Turn the current payment queue into a short operational summary.',
      );
      addSuggestion(
        'context-admin-payments-reminder',
        'Draft reminder',
        'Draft a payment reminder',
        'Generate a polished payment reminder for the active payment context.',
      );
      addSuggestion(
        'context-admin-payments-refund',
        'Explain refund status',
        'Explain refund status',
        'Summarize what is refunded, pending, or still waiting.',
      );
    }

    if (
      pageKey === 'client-event-payments' ||
      (user.role === Role.CLIENT && section === 'payments')
    ) {
      addSuggestion(
        'context-client-payments-next',
        'Show next payment',
        'Show next payment',
        'Surface the next payment milestone for this booking.',
      );
      addSuggestion(
        'context-client-payments-amount',
        'Explain pending amount',
        'Explain the pending amount',
        'Break down what is still pending and why.',
      );
      addSuggestion(
        'context-client-payments-refund',
        'Show refund status',
        'Show refund status',
        'Summarize whether a refund is pending, in progress, or complete.',
      );
      addSuggestion(
        'context-client-payments-support',
        'Contact support',
        'Contact support',
        'Open the support path with the payment context in view.',
      );
    }

    if (pageKey === 'admin-contracts' || pageKey === 'client-event-contracts') {
      addSuggestion(
        'context-contract-summary',
        'Summarize contract',
        'Summarize this contract',
        'Turn the current contract into a short premium summary.',
      );
      addSuggestion(
        'context-contract-version',
        'Show latest revision',
        'Show latest revision',
        'Open the most recent contract version and compare the current state.',
      );
      addSuggestion(
        'context-contract-signature',
        'Explain pending signatures',
        'Explain pending signatures',
        'Summarize the contract stage and what is still waiting on signature.',
      );
      addSuggestion(
        'context-contract-followup',
        'Draft follow-up',
        'Draft contract follow-up',
        'Generate a concise follow-up message for the agreement.',
      );
    }

    if (
      pageKey === 'client-chat' ||
      pageKey === 'admin-chat' ||
      pageKey === 'staff-chat'
    ) {
      addSuggestion(
        'context-chat-unread',
        'Summarize unread messages',
        'Summarize unread messages',
        'Condense unread messages and the next clean response.',
      );
      addSuggestion(
        'context-chat-draft',
        'Draft reply',
        'Draft reply for this chat',
        'Write a short, polished response for the current thread.',
      );
      addSuggestion(
        'context-chat-booking',
        'Related booking',
        'Show related booking',
        'Pull the booking context that this chat belongs to.',
      );
    }

    if (
      pageKey === 'staff-project-detail' ||
      pageKey === 'staff-booking-detail'
    ) {
      addSuggestion(
        'context-staff-blockers',
        'Show blockers',
        'What is blocked here?',
        'Surface the blockers, delays, and missing items that need attention.',
      );
      addSuggestion(
        'context-staff-uploads',
        'Find missing uploads',
        'Find missing uploads',
        'Surface the records that still need documents or attachments.',
      );
      addSuggestion(
        'context-staff-update',
        'Draft staff update',
        'Draft a staff assignment update',
        'Write a concise internal update for the team.',
      );
    }

    if (pageKey === 'vendor-project-detail') {
      addSuggestion(
        'context-vendor-payments',
        'Payment release',
        'Show payment release status',
        'Summarize whether the next release is still pending or ready.',
      );
      addSuggestion(
        'context-vendor-reminder',
        'Upload reminders',
        'Draft an upload reminder',
        'Write a short reminder for delivery docs or files.',
      );
      addSuggestion(
        'context-vendor-schedule',
        'Event schedule',
        'Show event schedule',
        'Surface the next event milestones and delivery deadlines.',
      );
    }

    if (section === 'payments' || currentView.includes('payments')) {
      if (overduePayments > 0) {
        addSuggestion(
          'context-overdue-payments',
          'Show overdue invoices',
          'Show overdue invoices',
          'Surface the payments that need collection first.',
        );
      }

      addSuggestion(
        'context-payment-reminder',
        'Draft reminder',
        'Draft a payment reminder',
        'Generate a client-ready payment reminder from the current payment context.',
      );

      addSuggestion(
        'context-payment-summary',
        'Pending amount',
        'Explain the pending amount',
        'Break down what is still pending and why.',
      );
    }

    if (section === 'contracts' || currentView.includes('contracts')) {
      if (unsignedContracts > 0) {
        addSuggestion(
          'context-contract-signature',
          'Pending signatures',
          'Explain pending signatures',
          'Summarize the contract stage and what is still waiting on signature.',
        );
      }

      addSuggestion(
        'context-contract-summary',
        'Summarize contract',
        'Summarize this contract',
        'Turn the current contract into a short premium summary.',
      );

      addSuggestion(
        'context-contract-followup',
        'Draft follow-up',
        'Draft contract follow-up',
        'Generate a concise follow-up message for the agreement.',
      );
    }

    if (section === 'chat' || currentView.includes('chat')) {
      if (unreadChats > 0) {
        addSuggestion(
          'context-chat-unread',
          'Unread messages',
          'Summarize unread messages',
          'Condense unread messages and the next clean response.',
        );
      }

      addSuggestion(
        'context-chat-draft',
        'Draft reply',
        'Draft reply for this chat',
        'Write a short, polished response for the current thread.',
      );
    }

    if (section === 'bookings' || currentView.includes('bookings')) {
      if (user.role === Role.ADMIN) {
        addSuggestion(
          'context-admin-booking-overdue',
          'Show overdue payments',
          'Show overdue payments',
          'Surface the bookings with overdue collection risk first.',
        );
        addSuggestion(
          'context-admin-booking-reminder',
          'Draft reminder',
          'Draft a payment reminder',
          'Generate a clean payment reminder for the booking in focus.',
        );
        addSuggestion(
          'context-admin-booking-staff',
          'Show missing staff',
          'Show missing staff',
          'Surface bookings that still need staffing coverage.',
        );
        addSuggestion(
          'context-admin-booking-chats',
          'Summarize unread chats',
          'Summarize unread chats',
          'Condense unread client chats for the current booking queue.',
        );
      }

      addSuggestion(
        'context-booking-summary',
        'Summarize booking',
        'Summarize this booking',
        'Turn the current booking into a tight premium brief.',
      );
      addSuggestion(
        'context-booking-pending',
        'What is pending?',
        'What is pending here?',
        'List the blockers that still need movement on this booking.',
      );
      if (blockedBookings > 0 || pendingTasks > 0) {
        addSuggestion(
          'context-booking-next-step',
          'Show next step',
          'What should happen next?',
          'Surface the next operational move for the active booking.',
        );
      }
    }

    if (section === 'projects' || currentView.includes('projects')) {
      addSuggestion(
        'context-project-delays',
        'Show delayed projects',
        'Show delayed projects',
        'Surface the projects that are slipping or have gone quiet.',
      );
      addSuggestion(
        'context-project-uploads',
        'Find missing uploads',
        'Find missing uploads',
        'Surface the projects that still need documents or attachments.',
      );

      if (blockedBookings > 0 || pendingTasks > 0) {
        addSuggestion(
          'context-project-blockers',
          'What is blocked?',
          'What is blocked here?',
          'Surface the blockers, delays, and missing items that need attention.',
        );
      }

      addSuggestion(
        'context-project-summary',
        'Project summary',
        'Summarize this project',
        'Give a short operational summary of the current project.',
      );
    }

    if (section === 'notifications' || currentView.includes('notifications')) {
      addSuggestion(
        'context-notifications',
        'Open notifications',
        'Show unread notifications',
        'Open the unread alert stream and the latest operational messages.',
      );
    }

    if (user.role === Role.ADMIN && pageKey === 'workspace-dashboard') {
      addSuggestion(
        'context-admin-summary',
        'Operations summary',
        'Give me an operational summary',
        'Summarize unread chats, overdue payments, unsigned contracts, and staffing gaps.',
      );
      addSuggestion(
        'context-admin-focus',
        'What needs movement?',
        'What needs movement right now?',
        'Surface the most urgent booking, payment, and contract issues.',
      );
    }

    if (user.role === Role.CLIENT && pageKey === 'workspace-dashboard') {
      addSuggestion(
        'context-client-summary',
        'Client overview',
        'What is pending for me right now?',
        'Surface the next payment, contract, or reply that needs attention.',
      );
    }

    if (hasTelemetrySignal(['payment', 'invoice', 'overdue', 'refund'])) {
      addSuggestion(
        'telemetry-payment-focus',
        'Show overdue invoices',
        'Show overdue invoices',
        'This is one of the most common follow-up patterns in Beer history.',
      );
    }

    if (hasTelemetrySignal(['contract', 'signature', 'signed', 'unsigned'])) {
      addSuggestion(
        'telemetry-contract-focus',
        'Explain pending signatures',
        'Explain pending signatures',
        'This shortcut is reinforced by common contract-related activity.',
      );
    }

    if (hasTelemetrySignal(['chat', 'message', 'unread', 'reply'])) {
      addSuggestion(
        'telemetry-chat-focus',
        'Summarize unread messages',
        'Summarize unread messages',
        'Beer is seeing a lot of chat follow-up activity in recent usage.',
      );
    }

    if (hasTelemetrySignal(['staff', 'assignment', 'vendor', 'upload'])) {
      addSuggestion(
        'telemetry-ops-focus',
        'Show missing staff',
        'Show missing staff',
        'Operational shortcuts are being used often enough to surface here.',
      );
    }

    if (hasTelemetrySignal(['search', 'find', 'lookup', 'history'])) {
      addSuggestion(
        'telemetry-search-focus',
        'Search previous conversations',
        'Search previous conversations',
        'This surfaces the most common search behavior from assistant telemetry.',
      );
    }

    const actionLabels = new Map<string, number>();
    for (const event of telemetryEvents) {
      if (event.eventType !== 'action_clicked' || !event.label) {
        continue;
      }

      actionLabels.set(event.label, (actionLabels.get(event.label) ?? 0) + 1);
    }

    const topActions = [...actionLabels.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3);

    for (const [label] of topActions) {
      const normalizedLabel = label.trim();
      if (!normalizedLabel) {
        continue;
      }

      addSuggestion(
        `context-action-${normalizedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        normalizedLabel,
        normalizedLabel,
        'One of the most used actions on this page.',
      );
    }

    return suggestions;
  }

  private dedupePromptSuggestions(
    suggestions: Array<
      AssistantPromptSuggestion & {
        role?: Role | null;
        pageKey?: string | null;
        rank?: number;
      }
    >,
  ) {
    const seen = new Set<string>();

    return suggestions.filter((suggestion) => {
      const key = suggestion.prompt.trim().toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  private extractAssistantTelemetryTerms(input: string) {
    const stopWords = new Set([
      'about',
      'after',
      'also',
      'and',
      'any',
      'are',
      'can',
      'could',
      'from',
      'have',
      'here',
      'into',
      'just',
      'need',
      'next',
      'okay',
      'please',
      'that',
      'the',
      'their',
      'them',
      'then',
      'this',
      'what',
      'when',
      'where',
      'which',
      'with',
      'would',
      'your',
    ]);

    return input
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .map((term) => term.trim())
      .filter((term) => term.length >= 4 && !stopWords.has(term));
  }

  private isFrustrationText(input: string) {
    const normalized = input.toLowerCase();
    return /(\bstill\b|\bagain\b|not working|doesn'?t make sense|does not make sense|wrong|frustrat|annoy|useless|can't|cannot|didn'?t|won't|won t)/.test(
      normalized,
    );
  }

  private isUnsupportedActionText(input: string) {
    const normalized = input.toLowerCase();
    return /\b(auto[- ]?send|delete|refund|charge|cancel|export|sync|integrat|assign|remove|upload|merge|approve|reassign|close|lock|unlock|force)\b/.test(
      normalized,
    );
  }

  private isLowConfidenceClassification(
    classification: AssistantClassification,
  ) {
    if (
      typeof classification.confidence === 'number' &&
      classification.confidence < 0.58
    ) {
      return true;
    }

    const scores = Object.values(classification.scores)
      .filter(
        (value): value is number => typeof value === 'number' && value > 0,
      )
      .sort((left, right) => right - left);
    const topScore = scores[0] ?? 0;
    const nextScore = scores[1] ?? 0;

    if (!classification.isMeaningful && topScore <= 2) {
      return true;
    }

    if (topScore <= 1) {
      return true;
    }

    if (topScore <= 2 && classification.matchedIntents.length <= 1) {
      return true;
    }

    return (
      topScore - nextScore <= 1 && classification.matchedIntents.length <= 1
    );
  }

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private formatDate(value: Date | string) {
    const date = typeof value === 'string' ? new Date(value) : value;

    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private includesAny(input: string, phrases: string[]) {
    return phrases.some((phrase) => input.includes(phrase));
  }

  private isIdentityQuestion(input: string) {
    return detectAssistantIdentityQuestion(input) || detectIdentityQuestion(input);
  }

  private isUserIdentityQuestion(input: string) {
    return detectUserIdentityQuestion(input);
  }

  private isCapabilityQuestion(input: string) {
    return detectCapabilityQuestion(input);
  }

  private isPersonalQuestion(input: string) {
    return detectPersonalQuestion(input);
  }

  private isCasualChatQuestion(input: string) {
    return detectCasualChatQuestion(input);
  }

  private isUnsupportedPersonalDataQuestion(input: string) {
    return detectUnsupportedPersonalDataQuestion(input);
  }

  private isOffTopicRequest(input: string) {
    return detectOffTopicRequest(input);
  }

  private isServiceRecommendationIntent(input: string) {
    return detectServiceRecommendationQuestion(input);
  }

  private isPageAboutIntent(input: string) {
    return this.includesAny(input, [
      'what is this page about',
      "what's this page about",
      'what is this page',
      'what does this page do',
      'explain this page',
    ]);
  }

  private isCreateBookingIntent(input: string) {
    return this.includesAny(input, [
      'create a booking',
      'new booking',
      'create booking',
      'book an event',
      'book for me',
      'start booking',
      'help me book',
      'take me to booking',
    ]);
  }

  private isBookingFollowUpIntent(
    input: string,
    history: AssistantHistoryEntry[],
  ) {
    const lastAssistantMessage = this.getLastHistoryMessage(
      history,
      'ASSISTANT',
    );

    if (!lastAssistantMessage) {
      return false;
    }

    const normalized = lastAssistantMessage.content.toLowerCase();

    return (
      this.includesAny(normalized, [
        'what type of event are you planning',
        'what date, venue, and guest count',
        'continue booking',
      ]) && this.looksLikeBookingDetail(input)
    );
  }

  private isPendingIntent(input: string) {
    return this.includesAny(input, [
      'what is pending',
      "what's pending",
      'what is left',
      'pending here',
    ]);
  }

  private isSummaryIntent(input: string) {
    return this.includesAny(input, [
      'summarize this booking',
      'summarise this booking',
      'summarize this project',
      'summarise this project',
      'summary of this',
    ]);
  }

  private isWorkspaceSearchIntent(
    input: string,
    context?: AssistantContextInput,
  ) {
    const normalized = input.toLowerCase();
    const searchSignal = this.includesAny(normalized, [
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
      'unread',
    ]);
    const structuredSignal =
      this.includesAny(normalized, ['show', 'find', 'list']) &&
      this.includesAny(normalized, [
        'booking',
        'bookings',
        'payment',
        'payments',
        'contract',
        'contracts',
        'project',
        'projects',
        'chat',
        'chats',
        'message',
        'messages',
        'notification',
        'notifications',
        'client',
        'clients',
        'vendor',
        'vendors',
        'conversation',
        'conversations',
        'thread',
        'threads',
      ]);
    const contextSignal =
      typeof context?.metadata?.searchTerm === 'string' &&
      context.metadata.searchTerm.trim().length > 0 &&
      this.includesAny(normalized, ['this', 'that', 'same', 'more', 'another']);
    const memoryRecord = this.toObjectRecord(
      context?.metadata?.assistantMemory as Prisma.JsonValue,
    );
    const memorySignal =
      typeof memoryRecord?.lastSearchQuery === 'string' &&
      memoryRecord.lastSearchQuery.trim().length > 0 &&
      this.includesAny(normalized, [
        'same',
        'that',
        'those',
        'these',
        'more',
        'another',
        'again',
      ]);

    return searchSignal || structuredSignal || contextSignal || memorySignal;
  }

  private isAssignmentsIntent(input: string) {
    return this.includesAny(input, [
      'who is assigned',
      'assigned to this project',
      'assigned here',
      'who is on this',
    ]);
  }

  private isPaymentsIntent(input: string) {
    return this.includesAny(input, [
      'show unpaid invoices',
      'overdue invoices',
      'show next payment',
      'outstanding payment',
      'pending payment',
      'unpaid invoice',
    ]);
  }

  private isContractsIntent(input: string) {
    return this.includesAny(input, [
      'pending contracts',
      'find all pending contracts',
      'show contracts',
    ]);
  }

  private isProposalIntent(input: string) {
    return this.includesAny(input, [
      'latest proposal',
      'open latest proposal',
      'show proposal',
    ]);
  }

  private isUnreadChatsIntent(input: string) {
    return this.includesAny(input, [
      'unread messages',
      'unread chats',
      'find chats with unread messages',
      'show unread chat',
    ]);
  }

  private isDraftIntent(input: string) {
    return (
      this.includesAny(input, [
        'draft reply',
        'draft message',
        'create a draft',
      ]) && !this.isPaymentReminderIntent(input)
    );
  }

  private isPaymentReminderIntent(input: string) {
    return this.includesAny(input, [
      'payment reminder',
      'generate a payment reminder',
      'remind them to pay',
    ]);
  }

  private isNextEventIntent(input: string) {
    return this.includesAny(input, [
      'show my next event',
      'next event',
      'next booking',
      'next assignment',
    ]);
  }

  private isNavigationIntent(input: string) {
    return this.includesAny(input, [
      'navigate me',
      'open project details',
      'project details',
      'take me to',
    ]);
  }

  private isNextStepIntent(input: string) {
    return this.includesAny(input, [
      'show me the next step',
      'what is the next step',
      'what should i do next',
      'what next',
      'next step',
    ]);
  }

  private isAfterSubmitIntent(input: string) {
    return this.includesAny(input, [
      'what happens after i submit',
      'what happens after submission',
      'after i submit',
      'after submission',
      'what happens next after i submit',
    ]);
  }

  private isSupportEscalationIntent(input: string) {
    return this.includesAny(input, [
      'book offline',
      'offline booking',
      'manual booking',
      'book manually',
      'human help',
      'someone book for me',
      'support escalation',
    ]);
  }

  private extractWorkspaceSearchTerms(input: string) {
    const stopWords = new Set([
      'a',
      'all',
      'and',
      'any',
      'around',
      'at',
      'be',
      'book',
      'booking',
      'bookings',
      'can',
      'check',
      'conversation',
      'conversations',
      'create',
      'customer',
      'customers',
      'find',
      'for',
      'from',
      'get',
      'give',
      'history',
      'in',
      'is',
      'last',
      'latest',
      'list',
      'look',
      'looked',
      'lookup',
      'me',
      'more',
      'my',
      'of',
      'older',
      'on',
      'open',
      'or',
      'previous',
      'recent',
      'search',
      'show',
      'showing',
      'that',
      'the',
      'this',
      'thread',
      'threads',
      'to',
      'up',
      'vendors',
      'vendor',
      'what',
      'which',
      'with',
      'your',
    ]);

    return Array.from(
      new Set(
        input
          .toLowerCase()
          .split(/[^a-z0-9₹]+/g)
          .map((term) => term.trim())
          .filter((term) => term.length > 1 && !stopWords.has(term)),
      ),
    );
  }

  private toObjectRecord(
    value: Prisma.JsonValue | null | undefined,
  ): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }
}

function effectiveProjectClient(project: any | null) {
  return project?.client ?? null;
}
