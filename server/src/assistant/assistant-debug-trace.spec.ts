import { Role } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AssistantOperationalService } from './assistant-operational.service';
import type {
  AssistantConversationMemory,
  AssistantHistoryEntry,
} from './assistant-engine.types';
import type { AssistantLlmComposerService } from './assistant-llm-composer.service';
import type { AssistantLlmUnderstandingService } from './assistant-llm-understanding.service';
import type { AssistantLlmUnderstandingOutput } from './assistant-understanding.types';
import { AssistantService } from './assistant.service';
import type { AssistantContextInput } from './assistant.types';

type DebugCase = {
  prompt: string;
  note: string;
  user: { userId: string; role: Role };
  context: AssistantContextInput;
  history?: AssistantHistoryEntry[];
  previousMemory?: AssistantConversationMemory | null;
  understanding: AssistantLlmUnderstandingOutput | null;
};

function makeUnderstanding(
  prompt: string,
  overrides: Partial<AssistantLlmUnderstandingOutput>,
): AssistantLlmUnderstandingOutput {
  return {
    normalizedMessage: prompt,
    primaryIntent: 'search_request',
    secondaryIntents: [],
    queryType: 'retrieval',
    timeframe: '',
    clarificationNeeded: false,
    clarificationQuestion: '',
    followUpContext: '',
    language: 'English',
    sentiment: 'neutral',
    frustration: false,
    ambiguity: 'low',
    confidence: 0.9,
    entities: {},
    ...overrides,
  };
}

function createSearchPrismaMock() {
  const leadHyd = {
    id: 'lead-hyd',
    eventType: 'Hyderabad Corporate Event',
    location: 'Hyderabad Business Center',
    city: 'Hyderabad',
    packageName: 'Corporate Event',
    packageLabel: 'Corporate',
    notes: 'Client mentioned bartender delay and wants updates.',
    clientId: 'client-1',
  };
  const leadChennai = {
    id: 'lead-chn',
    eventType: 'Chennai Pool Party',
    location: 'Chennai Beach Club',
    city: 'Chennai',
    packageName: 'Pool Party',
    packageLabel: 'Pool Party',
    notes: 'Client wants snacks and indoor backup.',
    clientId: 'client-2',
  };
  const leadDelhi = {
    id: 'lead-del',
    eventType: 'Delhi Wedding',
    location: 'Delhi Grand Hall',
    city: 'Delhi',
    packageName: 'Wedding',
    packageLabel: 'Wedding',
    notes: 'Unread client questions and approval pending.',
    clientId: 'client-3',
  };

  return {
    lead: {
      findMany: jest.fn().mockResolvedValue([leadHyd, leadChennai, leadDelhi]),
    },
    payment: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'payment-hyd',
          type: 'Balance payment',
          amount: 50000,
          dueDate: new Date('2026-04-02T10:00:00.000Z'),
          notes: 'Overdue payment for Hyderabad Corporate Event.',
          gatewayOrderId: 'gateway-hyd',
          transactionId: 'txn-hyd',
          status: 'PENDING',
          project: {
            id: 'project-hyd',
            client: { name: 'Aarav' },
            contract: {
              proposal: {
                lead: leadHyd,
              },
            },
          },
        },
        {
          id: 'payment-chn',
          type: 'Final payment',
          amount: 40000,
          dueDate: new Date('2026-04-05T10:00:00.000Z'),
          notes: 'Chennai pool party payment pending.',
          gatewayOrderId: 'gateway-chn',
          transactionId: 'txn-chn',
          status: 'FAILED',
          project: {
            id: 'project-chn',
            client: { name: 'Meera' },
            contract: {
              proposal: {
                lead: leadChennai,
              },
            },
          },
        },
      ]),
    },
    contract: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'contract-hyd',
          status: 'SENT',
          versions: [{ version: 2 }],
          proposal: {
            lead: leadHyd,
          },
          project: {
            client: { name: 'Aarav' },
          },
        },
        {
          id: 'contract-chn',
          status: 'DRAFT',
          versions: [{ version: 1 }],
          proposal: {
            lead: leadChennai,
          },
          project: {
            client: { name: 'Meera' },
          },
        },
      ]),
    },
    project: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'project-hyd',
          status: 'IN_PROGRESS',
          progress: 68,
          summary: 'Waiting on bartender assignment and final payment.',
          contract: {
            proposal: {
              lead: leadHyd,
            },
          },
          client: { name: 'Aarav' },
        },
        {
          id: 'project-chn',
          status: 'IN_PROGRESS',
          progress: 52,
          summary: 'Chennai pool party is waiting on staff confirmation.',
          contract: {
            proposal: {
              lead: leadChennai,
            },
          },
          client: { name: 'Meera' },
        },
      ]),
    },
    conversationThread: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'thread-hyd',
          lead: {
            id: leadHyd.id,
            eventType: leadHyd.eventType,
            location: leadHyd.location,
            eventDate: new Date('2026-04-10T10:00:00.000Z'),
          },
          messages: [
            {
              body: 'Client asked about bartender delay.',
              senderId: 'client-1',
              readAt: null,
            },
          ],
        },
        {
          id: 'thread-chn',
          lead: {
            id: leadChennai.id,
            eventType: leadChennai.eventType,
            location: leadChennai.location,
            eventDate: new Date('2026-04-11T10:00:00.000Z'),
          },
          messages: [
            {
              body: 'Client wants indoor seating and snacks.',
              senderId: 'client-2',
              readAt: null,
            },
          ],
        },
      ]),
    },
    notification: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'notification-payment',
          title: 'Payment reminder',
          body: 'Hyderabad payment is still pending.',
        },
        {
          id: 'notification-contract',
          title: 'Signature reminder',
          body: 'Chennai contract is unsigned.',
        },
      ]),
    },
    aiConversation: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'conversation-hyd',
          title: 'Hyderabad corporate event thread',
          preview: 'Bartender delay and payment follow-up.',
          contexts: [{ pageTitle: 'Bookings' }],
        },
        {
          id: 'conversation-chn',
          title: 'Chennai pool party thread',
          preview: 'Indoor setup and snacks requested.',
          contexts: [{ pageTitle: 'Bookings' }],
        },
      ]),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'client-1',
          name: 'Aarav',
          email: 'aarav@example.com',
          phone: '+91-90000-00001',
          _count: { leads: 2, projects: 1 },
        },
        {
          id: 'client-2',
          name: 'Meera',
          email: 'meera@example.com',
          phone: '+91-90000-00002',
          _count: { leads: 1, projects: 1 },
        },
      ]),
    },
    vendor: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'vendor-1',
          name: 'Bartender Team',
          serviceType: 'Bartending',
          isAvailable: false,
          _count: { assignments: 4 },
        },
        {
          id: 'vendor-2',
          name: 'Snack Crew',
          serviceType: 'Catering',
          isAvailable: true,
          _count: { assignments: 1 },
        },
      ]),
    },
  };
}

function createDebugService(understandingOutput: AssistantLlmUnderstandingOutput | null) {
  const prisma = createSearchPrismaMock() as unknown as PrismaService;
  const llmComposer = {
    isEnabled: () => false,
    getModelName: () => 'mock-model',
    getBaseUrl: () => 'https://api.openai.com/v1',
    compose: jest.fn(),
  } as unknown as AssistantLlmComposerService;
  const understandingService = {
    isEnabled: () => true,
    getModelName: () => 'mock-model',
    getBaseUrl: () => 'https://api.openai.com/v1',
    understand: jest.fn(
      async (
        _input: unknown,
        diagnostics?: {
          called: boolean;
          source: 'llm' | 'deterministic';
          success: boolean | null;
          statusCode: number | null;
          durationMs: number | null;
          fallbackReason: string | null;
          deterministicFallbackUsed: boolean;
          error: string | null;
        } | null,
      ) => {
        if (diagnostics) {
          diagnostics.called = true;
          diagnostics.source = 'llm';
          diagnostics.success = understandingOutput !== null;
          diagnostics.statusCode = understandingOutput ? 200 : null;
          diagnostics.durationMs = 12;
          diagnostics.fallbackReason = understandingOutput ? null : 'mock_null';
          diagnostics.deterministicFallbackUsed = understandingOutput === null;
          diagnostics.error = null;
        }

        return understandingOutput;
      },
    ),
  } as unknown as AssistantLlmUnderstandingService;
  const operationalService = {
    getOperationalSummary: jest.fn(),
  } as unknown as AssistantOperationalService;

  const service = new AssistantService(
    prisma,
    llmComposer,
    understandingService,
    operationalService,
  );

  jest.spyOn(service as any, 'getLeadFromContext').mockResolvedValue(null);
  jest.spyOn(service as any, 'getProjectFromContext').mockResolvedValue(null);

  const routeResponseTypes: Record<string, string> = {
    buildGreetingReply: 'greeting',
    buildIdentityReply: 'identity',
    buildCapabilityReply: 'capability',
    buildOperationalReply: 'operational_summary',
    buildDashboardHelpReply: 'dashboard_help',
    buildUnsupportedReply: 'unsupported_request',
    buildEscalationReply: 'escalation',
    buildAfterSubmitReply: 'after_submit',
    buildNextStepReply: 'next_step_help',
    buildBookingConsultationReply: 'booking_recommendation',
    buildCreateBookingReply: 'create_booking',
    buildPendingReply: 'pending_summary',
    buildSummaryReply: 'entity_summary',
    buildAssignmentsReply: 'assignment_summary',
    buildPaymentReminderReply: 'payment_reminder',
    buildDraftReply: 'draft_preview',
    buildUnreadChatsReply: 'unread_chat_summary',
    buildPaymentsReply: 'payments_summary',
    buildContractsReply: 'contract_summary',
    buildProposalReply: 'proposal_summary',
    buildNextEventReply: 'next_event_summary',
    buildNavigationReply: 'navigation',
    buildFallbackReply: 'fallback',
  };

  const makeTurn = (responseType: string) => ({
    content: `Debug ${responseType} response.`,
    actions: [
      {
        id: `${responseType}-action`,
        type: 'OPEN',
        label: `Debug ${responseType}`,
        description: `Debug action for ${responseType}.`,
      },
    ],
    metadata: {
      responseType,
      responseStyle: responseType,
      llmComposed: false,
    },
  });

  for (const [method, responseType] of Object.entries(routeResponseTypes)) {
    jest.spyOn(service as any, method).mockImplementation(async () =>
      makeTurn(responseType),
    );
  }

  return service;
}

async function runDebugCase(input: DebugCase) {
  const service = createDebugService(input.understanding);
  const state = await (service as any).prepareAssistantTurnState({
    user: input.user,
    message: input.prompt,
    context: input.context,
    history: input.history ?? [],
    previousMemory: input.previousMemory ?? null,
  });

  const trace = (service as any).createAssistantPipelineDebugTrace({
    user: input.user,
    message: input.prompt,
    context: input.context,
    state: state.turnState,
  });

  const turn = await (service as any).generateAssistantTurn(
    input.user,
    state.analysisMessage,
    state.requestContext,
    state.turnState,
    trace,
  );

  let finalTurn = (service as any).attachUnderstandingToTurn(
    turn,
    state.understanding,
    state.turnState.diagnostics,
  );
  finalTurn = (service as any).annotateAssistantTurnStyle({
    user: input.user,
    message: state.analysisMessage,
    context: state.requestContext,
    history: state.turnState.history,
    classification: state.classification,
    memory: state.activeMemory,
    entities: state.entities,
    pageKey: state.pageKey,
    section: state.section,
    turn: finalTurn,
  });
  finalTurn = await (service as any).maybeComposeAssistantTurn({
    user: input.user,
    message: state.analysisMessage,
    context: state.requestContext,
    history: state.turnState.history,
    classification: state.classification,
    memory: state.activeMemory,
    entities: state.entities,
    pageKey: state.pageKey,
    section: state.section,
    turn: finalTurn,
    diagnostics: state.turnState.diagnostics,
  });

  (service as any).finalizeAssistantPipelineDebugTrace(trace, finalTurn);

  console.info(
    JSON.stringify(
      {
        prompt: input.prompt,
        note: input.note,
        route: finalTurn.metadata?.responseType ?? null,
        trace,
      },
      null,
      2,
    ),
  );

  return {
    service,
    state,
    trace,
    turn: finalTurn,
  };
}

describe('assistant pipeline debug trace', () => {
  const adminUser = {
    userId: 'admin-user',
    role: Role.ADMIN,
  } as const;
  const clientUser = {
    userId: 'client-user',
    role: Role.CLIENT,
  } as const;

  const bookingContext: AssistantContextInput = {
    pagePath: '/dashboard/bookings',
    pageTitle: 'Bookings',
    metadata: {
      section: 'booking',
    },
  };

  const adminContext: AssistantContextInput = {
    pagePath: '/admin',
    pageTitle: 'Dashboard',
    metadata: {
      section: 'general',
    },
  };

  const projectContext: AssistantContextInput = {
    pagePath: '/admin/projects',
    pageTitle: 'Projects',
    metadata: {
      section: 'project',
    },
  };

  const hyderabadMemory: AssistantConversationMemory = {
    currentRole: Role.CLIENT,
    currentPagePath: '/dashboard/bookings',
    currentPageTitle: 'Bookings',
    lastSearchQuery: 'Hyderabad Corporate Event',
    selectedBookingId: 'lead-hyd',
    selectedProjectId: 'project-hyd',
    city: 'Hyderabad',
    lastPrimaryIntent: 'booking_inquiry',
    meaningfulTurns: 3,
    lastUpdatedAt: new Date().toISOString(),
  } as AssistantConversationMemory;

  const overdueMemory: AssistantConversationMemory = {
    currentRole: Role.CLIENT,
    currentPagePath: '/dashboard/bookings',
    currentPageTitle: 'Bookings',
    lastSearchQuery: 'overdue payment',
    selectedBookingId: 'lead-hyd',
    selectedProjectId: 'project-hyd',
    city: 'Hyderabad',
    lastPrimaryIntent: 'payment_help',
    meaningfulTurns: 2,
    lastUpdatedAt: new Date().toISOString(),
  } as AssistantConversationMemory;

  const cases: DebugCase[] = [
    {
      prompt: 'any recent bookings?',
      note: 'retrieval-style prompt should stay in the search/retrieval lane',
      user: clientUser,
      context: bookingContext,
      understanding: makeUnderstanding('Show recent bookings.', {
        primaryIntent: 'search_request',
        secondaryIntents: ['booking_inquiry'],
        queryType: 'retrieval',
        timeframe: 'recent',
        entities: {},
      }),
    },
    {
      prompt: 'any booked the service recently?',
      note: 'watch for booking recommendation bias on a retrieval-style query',
      user: clientUser,
      context: bookingContext,
      understanding: makeUnderstanding('Any recent bookings?', {
        primaryIntent: 'booking_inquiry',
        secondaryIntents: ['search_request'],
        queryType: 'booking',
        entities: {},
      }),
    },
    {
      prompt: 'Hyderabad wala booking dikhao',
      note: 'should preserve Hyderabad memory and surface the same booking context',
      user: clientUser,
      context: bookingContext,
      previousMemory: hyderabadMemory,
      understanding: makeUnderstanding('Show the Hyderabad booking.', {
        primaryIntent: 'search_request',
        secondaryIntents: ['booking_follow_up'],
        queryType: 'retrieval',
        entities: {
          city: 'Hyderabad',
        },
      }),
    },
    {
      prompt: 'the one with overdue payment',
      note: 'should route to payment or retrieval logic, not a generic booking recommendation',
      user: clientUser,
      context: bookingContext,
      previousMemory: overdueMemory,
      understanding: makeUnderstanding('Show the booking with overdue payment.', {
        primaryIntent: 'payment_help',
        secondaryIntents: ['search_request'],
        queryType: 'retrieval',
        entities: {
          paymentStatus: 'pending',
        },
      }),
    },
    {
      prompt: 'the Chennai pool party request',
      note: 'should still understand this as a booking request with city and event type',
      user: clientUser,
      context: bookingContext,
      understanding: makeUnderstanding('I need a Chennai pool party booking.', {
        primaryIntent: 'booking_inquiry',
        secondaryIntents: ['service_recommendation'],
        queryType: 'booking',
        entities: {
          city: 'Chennai',
          eventType: 'pool party',
        },
      }),
    },
    {
      prompt: 'show latest bookings needing attention',
      note: 'should use operational summary logic instead of falling back to booking consult',
      user: adminUser,
      context: adminContext,
      understanding: makeUnderstanding('Show latest bookings needing attention.', {
        primaryIntent: 'operational_summary',
        secondaryIntents: ['search_request'],
        queryType: 'operational',
        entities: {},
      }),
    },
    {
      prompt: 'the project where bartender assignment is missing',
      note: 'should land in operational project/assignment handling',
      user: adminUser,
      context: projectContext,
      understanding: makeUnderstanding('Show the project where bartender assignment is missing.', {
        primaryIntent: 'missing_assignments',
        secondaryIntents: ['search_request'],
        queryType: 'operational',
        entities: {},
      }),
    },
  ];

  it.each(cases)('$prompt', async (input) => {
    const result = await runDebugCase(input);

    expect(result.trace.rawUserMessage).toBe(input.prompt);
    expect(result.trace.final).not.toBeNull();
    expect(result.turn.actions.length).toBeGreaterThan(0);
  });
});
