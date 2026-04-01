import { Role } from '@prisma/client';
import type { AssistantOperationalService } from './assistant-operational.service';
import type {
  AssistantClassification,
  AssistantConversationMemory,
  AssistantHistoryEntry,
  AssistantExtractedEntities,
} from './assistant-engine.types';
import { classifyAssistantInput } from './assistant-intent-classifier';
import { extractAssistantEntities } from './assistant-entity-extractor';
import { mergeAssistantMemory } from './assistant-memory-manager';
import type { AssistantContextInput } from './assistant.types';
import type { PrismaService } from '../prisma/prisma.service';
import { AssistantService } from './assistant.service';
import { classifyAssistantResponseStyle } from './assistant-response-style';
import type { AssistantLlmComposerService } from './assistant-llm-composer.service';
import type { AssistantLlmUnderstandingService } from './assistant-llm-understanding.service';
import type { AssistantLlmUnderstandingOutput } from './assistant-understanding.types';
import type {
  AssistantOperationalRecord,
  AssistantOperationalSummary,
} from './assistant-operational.service';

function createService(
  understandingOutput: AssistantLlmUnderstandingOutput | null = null,
) {
  const prisma = {} as PrismaService;
  const llmComposer = {
    isEnabled: () => false,
    getModelName: () => 'mock-model',
    getBaseUrl: () => 'https://api.openai.com/v1',
    compose: jest.fn(),
  } as unknown as AssistantLlmComposerService;
  const understandingService = {
    isEnabled: () => false,
    getModelName: () => 'mock-model',
    getBaseUrl: () => 'https://api.openai.com/v1',
    understand: jest.fn().mockResolvedValue(understandingOutput),
  } as unknown as AssistantLlmUnderstandingService;
  const operationalService = {
    getOperationalSummary: jest.fn().mockResolvedValue(makeBusyOperationalSummary()),
  } as unknown as AssistantOperationalService;

  const service = new AssistantService(
    prisma,
    llmComposer,
    understandingService,
    operationalService,
  );
  jest.spyOn(service as any, 'getLeadFromContext').mockResolvedValue(null);
  jest.spyOn(service as any, 'getProjectFromContext').mockResolvedValue(null);

  return service;
}

function makeRecord(
  kind: AssistantOperationalRecord['kind'],
  title: string,
  reason: string,
  overrides: Partial<AssistantOperationalRecord> = {},
): AssistantOperationalRecord {
  return {
    id: overrides.id ?? `${kind}-${title}`,
    kind,
    title,
    subtitle: overrides.subtitle ?? '',
    reason,
    reasons: overrides.reasons ?? [reason],
    severity: overrides.severity ?? 1,
    sortAt: overrides.sortAt ?? new Date().toISOString(),
    leadId: overrides.leadId ?? null,
    projectId: overrides.projectId ?? null,
    paymentId: overrides.paymentId ?? null,
    contractId: overrides.contractId ?? null,
    taskId: overrides.taskId ?? null,
    threadId: overrides.threadId ?? null,
    city: overrides.city ?? null,
    status: overrides.status ?? null,
    amount: overrides.amount ?? null,
    currency: overrides.currency ?? null,
    unreadCount: overrides.unreadCount ?? null,
    staff: overrides.staff ?? [],
  };
}

function makeBucket(items: AssistantOperationalRecord[], count = items.length) {
  return {
    count,
    totalSeverity: items.reduce((sum, item) => sum + item.severity, 0),
    items,
  };
}

function makeBusyOperationalSummary(): AssistantOperationalSummary {
  const now = new Date();
  const daysFromNow = (days: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    return date.toISOString();
  };

  const hyderabadBooking = makeRecord(
    'booking',
    'Hyderabad Office Event',
    'Missing bartender assignment',
    {
      severity: 9,
      sortAt: daysFromNow(2),
      leadId: 'lead-hyd',
      projectId: 'project-hyd',
      city: 'Hyderabad',
      status: 'IN_PROGRESS',
      staff: [],
      reasons: [
        'Event is in 2 days',
        'No active staff assignment',
        'Unsigned contract',
        'Unread client messages',
      ],
    },
  );

  const delhiBooking = makeRecord(
    'booking',
    'Delhi Wedding',
    'Unread client questions',
    {
      severity: 7,
      sortAt: daysFromNow(5),
      leadId: 'lead-delhi',
      projectId: 'project-delhi',
      city: 'Delhi',
      status: 'IN_PROGRESS',
      staff: ['Anika'],
      unreadCount: 2,
      reasons: ['Client has unread questions', 'Contract not yet signed'],
    },
  );

  const bangaloreBooking = makeRecord(
    'booking',
    'Bangalore Festival',
    'Unsigned contract',
    {
      severity: 6,
      sortAt: daysFromNow(8),
      leadId: 'lead-blr',
      projectId: 'project-blr',
      city: 'Bangalore',
      status: 'IN_PROGRESS',
      staff: ['Ravi'],
      reasons: ['Contract is still unsigned', 'Event is within the next 14 days'],
    },
  );

  const mumbaiBooking = makeRecord(
    'booking',
    'Mumbai Launch Party',
    'Balance payment overdue',
    {
      severity: 5,
      sortAt: daysFromNow(10),
      leadId: 'lead-mum',
      projectId: 'project-mum',
      city: 'Mumbai',
      status: 'IN_PROGRESS',
      staff: ['Meera'],
      reasons: ['Payment is overdue', 'Event is approaching soon'],
    },
  );

  const pendingTaskOne = makeRecord(
    'task',
    'Hyderabad Office Event setup task',
    'Task is overdue',
    {
      severity: 5,
      sortAt: daysFromNow(-1),
      leadId: 'lead-hyd',
      projectId: 'project-hyd',
      taskId: 'task-hyd-1',
      city: 'Hyderabad',
      status: 'BLOCKED',
      reasons: ['Task is blocked', 'Overdue by 1 day', 'Task is unassigned'],
    },
  );

  const pendingTaskTwo = makeRecord(
    'task',
    'Delhi Wedding menu task',
    'Due soon',
    {
      severity: 3,
      sortAt: daysFromNow(1),
      leadId: 'lead-delhi',
      projectId: 'project-delhi',
      taskId: 'task-delhi-1',
      city: 'Delhi',
      status: 'OPEN',
      reasons: ['Due in 1 day', 'Task is assigned'],
    },
  );

  const pendingTaskThree = makeRecord(
    'task',
    'Bangalore Festival staffing task',
    'Critical priority',
    {
      severity: 2,
      sortAt: daysFromNow(2),
      leadId: 'lead-blr',
      projectId: 'project-blr',
      taskId: 'task-blr-1',
      city: 'Bangalore',
      status: 'OPEN',
      reasons: ['Due in 2 days', 'Critical priority'],
    },
  );

  const paymentOne = makeRecord(
    'payment',
    'Mumbai Launch Party payment',
    'Payment is overdue',
    {
      severity: 4,
      sortAt: daysFromNow(-3),
      leadId: 'lead-mum',
      projectId: 'project-mum',
      paymentId: 'payment-mum-1',
      amount: 50000,
      currency: 'INR',
      city: 'Mumbai',
      status: 'PENDING',
      reasons: ['Payment is overdue', 'Due on 25 Mar 2026'],
    },
  );

  const paymentTwo = makeRecord(
    'payment',
    'Hyderabad Office Event payment',
    'Payment is overdue',
    {
      severity: 3,
      sortAt: daysFromNow(-2),
      leadId: 'lead-hyd',
      projectId: 'project-hyd',
      paymentId: 'payment-hyd-1',
      amount: 25000,
      currency: 'INR',
      city: 'Hyderabad',
      status: 'FAILED',
      reasons: ['Payment failed', 'Overdue by 2 days'],
    },
  );

  const contractOne = makeRecord(
    'contract',
    'Bangalore Festival contract',
    'Contract is still unsigned',
    {
      severity: 3,
      sortAt: daysFromNow(8),
      leadId: 'lead-blr',
      projectId: 'project-blr',
      contractId: 'contract-blr-1',
      city: 'Bangalore',
      status: 'SENT',
      reasons: ['Contract is still unsigned', 'Event is within 14 days'],
    },
  );

  const contractTwo = makeRecord(
    'contract',
    'Mumbai Launch Party contract',
    'Contract is still unsigned',
    {
      severity: 2,
      sortAt: daysFromNow(10),
      leadId: 'lead-mum',
      projectId: 'project-mum',
      contractId: 'contract-mum-1',
      city: 'Mumbai',
      status: 'DRAFT',
      reasons: ['Contract is still unsigned'],
    },
  );

  const approvalOne = makeRecord(
    'approval',
    'Delhi Wedding proposal',
    'Proposal is waiting on approval',
    {
      severity: 2,
      sortAt: daysFromNow(3),
      leadId: 'lead-delhi',
      projectId: 'project-delhi',
      city: 'Delhi',
      status: 'SENT',
      reasons: ['Proposal is waiting on approval'],
    },
  );

  const approvalTwo = makeRecord(
    'approval',
    'Hyderabad Office Event proposal',
    'Proposal is waiting on approval',
    {
      severity: 1,
      sortAt: daysFromNow(4),
      leadId: 'lead-hyd',
      projectId: 'project-hyd',
      city: 'Hyderabad',
      status: 'SENT',
      reasons: ['Proposal is waiting on approval'],
    },
  );

  const projectOne = makeRecord(
    'project',
    'Hyderabad Office Event project',
    'Project has been stalled for more than a week',
    {
      severity: 8,
      sortAt: daysFromNow(-8),
      leadId: 'lead-hyd',
      projectId: 'project-hyd',
      city: 'Hyderabad',
      status: 'IN_PROGRESS',
      reasons: [
        'Project has been stalled for more than a week',
        'No active staff assignment',
      ],
    },
  );

  const threadOne = makeRecord(
    'thread',
    'Hyderabad Office Event chat',
    'Waiting for a reply',
    {
      severity: 4,
      sortAt: daysFromNow(-1),
      leadId: 'lead-hyd',
      threadId: 'thread-hyd-1',
      city: 'Hyderabad',
      unreadCount: 3,
      reasons: ['Waiting for a reply'],
    },
  );

  const threadTwo = makeRecord(
    'thread',
    'Delhi Wedding chat',
    'Waiting for a reply',
    {
      severity: 3,
      sortAt: daysFromNow(-1),
      leadId: 'lead-delhi',
      threadId: 'thread-delhi-1',
      city: 'Delhi',
      unreadCount: 2,
      reasons: ['Waiting for a reply'],
    },
  );

  const threadThree = makeRecord(
    'thread',
    'Mumbai Launch Party chat',
    'Waiting for a reply',
    {
      severity: 2,
      sortAt: daysFromNow(-1),
      leadId: 'lead-mum',
      threadId: 'thread-mum-1',
      city: 'Mumbai',
      unreadCount: 1,
      reasons: ['Waiting for a reply'],
    },
  );

  const notificationOne = makeRecord(
    'notification',
    'Payment reminder',
    'Unread notification',
    {
      severity: 1,
      sortAt: daysFromNow(-1),
      status: 'PAYMENT',
      reasons: ['Unread notification'],
    },
  );

  const notificationTwo = makeRecord(
    'notification',
    'Signature reminder',
    'Unread notification',
    {
      severity: 1,
      sortAt: daysFromNow(-1),
      status: 'CONTRACT',
      reasons: ['Unread notification'],
    },
  );

  return {
    generatedAt: now.toISOString(),
    counts: {
      unreadNotifications: 2,
      unreadThreads: 5,
      unreadMessages: 9,
      overduePayments: 4,
      overduePaymentAmount: 100000,
      unsignedContracts: 2,
      pendingTasks: 3,
      overdueTasks: 1,
      blockedTasks: 1,
      upcomingBookings: 4,
      blockedBookings: 2,
      stalledProjects: 1,
      missingAssignments: 3,
      pendingApprovals: 2,
    },
    unread: {
      notifications: makeBucket([notificationOne, notificationTwo], 2),
      threads: makeBucket([threadOne, threadTwo, threadThree], 5),
      messages: 9,
    },
    pendingTasks: Object.assign(makeBucket([pendingTaskOne, pendingTaskTwo, pendingTaskThree], 3), {
      overdueCount: 1,
      blockedCount: 1,
    }),
    overdueItems: makeBucket([paymentOne, pendingTaskOne, contractOne, projectOne], 4),
    upcomingBookings: makeBucket([hyderabadBooking, delhiBooking, bangaloreBooking, mumbaiBooking], 4),
    blockedBookings: makeBucket([hyderabadBooking, delhiBooking], 2),
    stalledProjects: makeBucket([projectOne], 1),
    missingAssignments: makeBucket([hyderabadBooking, bangaloreBooking, mumbaiBooking], 3),
    pendingApprovals: makeBucket([approvalOne, approvalTwo], 2),
    overduePayments: Object.assign(makeBucket([paymentOne, paymentTwo, makeRecord('payment', 'Delhi Wedding payment', 'Payment is overdue', {
      severity: 3,
      sortAt: daysFromNow(-1),
      leadId: 'lead-delhi',
      projectId: 'project-delhi',
      paymentId: 'payment-delhi-1',
      amount: 20000,
      currency: 'INR',
      city: 'Delhi',
      status: 'PENDING',
      reasons: ['Payment is overdue'],
    }), makeRecord('payment', 'Bangalore Festival payment', 'Payment is overdue', {
      severity: 2,
      sortAt: daysFromNow(-5),
      leadId: 'lead-blr',
      projectId: 'project-blr',
      paymentId: 'payment-blr-1',
      amount: 15000,
      currency: 'INR',
      city: 'Bangalore',
      status: 'PENDING',
      reasons: ['Payment is overdue'],
    })], 4), {
      totalAmount: 100000,
    }),
    unsignedContracts: makeBucket([contractOne, contractTwo], 2),
    topIssues: [hyderabadBooking, paymentOne, contractOne, projectOne],
    isEmpty: false,
    calmState: [
      'Everything looks clean right now. No overdue payments, blocked bookings, or unsigned contracts.',
      'Upcoming bookings are still on the calendar.',
    ],
  };
}

function makeEmptyOperationalSummary(): AssistantOperationalSummary {
  return {
    generatedAt: new Date().toISOString(),
    counts: {
      unreadNotifications: 0,
      unreadThreads: 0,
      unreadMessages: 0,
      overduePayments: 0,
      overduePaymentAmount: 0,
      unsignedContracts: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      blockedTasks: 0,
      upcomingBookings: 0,
      blockedBookings: 0,
      stalledProjects: 0,
      missingAssignments: 0,
      pendingApprovals: 0,
    },
    unread: {
      notifications: makeBucket([], 0),
      threads: makeBucket([], 0),
      messages: 0,
    },
    pendingTasks: Object.assign(makeBucket([], 0), {
      overdueCount: 0,
      blockedCount: 0,
    }),
    overdueItems: makeBucket([], 0),
    upcomingBookings: makeBucket([], 0),
    blockedBookings: makeBucket([], 0),
    stalledProjects: makeBucket([], 0),
    missingAssignments: makeBucket([], 0),
    pendingApprovals: makeBucket([], 0),
    overduePayments: Object.assign(makeBucket([], 0), {
      totalAmount: 0,
    }),
    unsignedContracts: makeBucket([], 0),
    topIssues: [],
    isEmpty: true,
    calmState: [
      'Everything looks clean right now. No overdue payments, blocked bookings, or unsigned contracts.',
      'You can still review upcoming bookings, recent chats, and open projects.',
    ],
  };
}

function buildTurnState(
  message: string,
  context: AssistantContextInput,
  role: Role,
  history: AssistantHistoryEntry[],
  memory: AssistantConversationMemory | null,
) {
  const entities = extractAssistantEntities({
    message,
    context,
    history,
    role,
    memory,
  });

  const classification = classifyAssistantInput({
    message,
    context,
    history,
    memory,
    entities,
  });

  return {
    history,
    classification,
    memory,
    entities,
  };
}

async function runTurn(
  service: AssistantService,
  user: { userId: string; role: Role },
  message: string,
  context: AssistantContextInput,
  memory: AssistantConversationMemory | null = null,
  history: AssistantHistoryEntry[] = [],
) {
  const state = buildTurnState(message, context, user.role, history, memory);
  return (service as any).generateAssistantTurn(user, message, context, state);
}

function advanceMemory(
  previous: AssistantConversationMemory | null,
  user: { userId: string; role: Role },
  message: string,
  context: AssistantContextInput,
  history: AssistantHistoryEntry[],
) {
  const state = buildTurnState(message, context, user.role, history, previous);
  return mergeAssistantMemory({
    previous,
    context,
    role: user.role,
    entities: state.entities,
    classification: state.classification,
  });
}

describe('assistant response style', () => {
  it('classifies greetings, identity, capability, follow-up, and unsupported requests', () => {
    expect(
      classifyAssistantResponseStyle({
        message: 'hi',
        classification: {
          primaryIntent: 'greeting',
          matchedIntents: ['greeting'],
          scores: {},
          isMeaningful: false,
        },
      }),
    ).toBe('greeting');

    expect(
      classifyAssistantResponseStyle({
        message: 'who are you',
        classification: {
          primaryIntent: 'informational_question',
          matchedIntents: ['informational_question'],
          scores: {},
          isMeaningful: true,
        },
      }),
    ).toBe('identity');

    expect(
      classifyAssistantResponseStyle({
        message: 'what can you do',
        classification: {
          primaryIntent: 'informational_question',
          matchedIntents: ['informational_question'],
          scores: {},
          isMeaningful: true,
        },
      }),
    ).toBe('capability');

    expect(
      classifyAssistantResponseStyle({
        message: 'make it cheaper',
        classification: {
          primaryIntent: 'budget_discussion',
          matchedIntents: ['budget_discussion'],
          scores: {},
          isMeaningful: true,
        },
        memory: {
          selectedBookingId: 'booking-1',
        } as never,
      }),
    ).toBe('follow_up');

    expect(
      classifyAssistantResponseStyle({
        message: 'I want a sex party',
        classification: {
          primaryIntent: 'unsupported_request',
          matchedIntents: ['unsupported_request'],
          scores: {},
          isMeaningful: true,
        },
      }),
    ).toBe('unsupported_request');
  });
});

describe('assistant response copy', () => {
  const adminUser = {
    userId: 'user-1',
    role: Role.ADMIN,
  } as const;

  const clientUser = {
    userId: 'user-2',
    role: Role.CLIENT,
  } as const;

  const baseContext = {
    pagePath: '/admin',
    pageTitle: 'Dashboard',
    metadata: {
      section: 'general',
    },
  };

  it('opens with a useful greeting for admins', async () => {
    const service = createService();
    const result = await (service as unknown as {
      buildGreetingReply: (
        user: any,
        pageKey: string,
        context: any,
        memory: null,
      ) => Promise<{ content: string; actions: Array<{ label: string }> }>;
    }).buildGreetingReply(adminUser, 'workspace-dashboard', baseContext, null);

    expect(result.content).toContain("I'm Beer");
    expect(result.content).toContain('overdue payments');
    expect(result.content).toContain('unread chats');
    expect(result.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining([
        'What needs attention?',
        'Show overdue payments',
        'Show unread chats',
        'Show blocked bookings',
      ]),
    );
  });

  it('answers identity and capability questions directly', () => {
    const service = createService();
    const identity = (service as unknown as {
      buildIdentityReply: (
        user: any,
        context: any,
        pageKey: string,
        memory: null,
      ) => { content: string; actions: Array<{ label: string }> };
    }).buildIdentityReply(clientUser, baseContext, 'workspace-dashboard', null);

    const capability = (service as unknown as {
      buildCapabilityReply: (
        user: any,
        context: any,
        pageKey: string,
        memory: null,
      ) => { content: string; actions: Array<{ label: string }> };
    }).buildCapabilityReply(clientUser, baseContext, 'workspace-dashboard', null);

    expect(identity.content).toContain('in-site assistant');
    expect(capability.content).toContain('bookings');
    expect(capability.content).toContain('payments');
  });

  it('keeps booking follow-ups in the same context', () => {
    const service = createService();
    const result = (service as unknown as {
      buildBookingConsultationReply: (
        user: any,
        context: any,
        memory: Record<string, unknown>,
        classification: {
          primaryIntent: string;
          matchedIntents: string[];
          scores: Record<string, number>;
          isMeaningful: boolean;
        },
        message: string,
      ) => { content: string; actions: Array<{ label: string }> } | null;
    }).buildBookingConsultationReply(
      clientUser,
      baseContext,
      {
        budgetPreference: 'lower',
      },
      {
        primaryIntent: 'budget_discussion',
        matchedIntents: ['budget_discussion'],
        scores: {},
        isMeaningful: true,
      },
      'make it premium instead',
    );

    expect(result?.content).toContain('same booking');
    expect(result?.content).toContain('more premium');
    expect(result?.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining(['Make it premium']),
    );
  });

  it('refuses unsupported requests without mapping them to a corporate event', () => {
    const service = createService();
    const result = (service as unknown as {
      buildUnsupportedReply: (
        user: any,
        context: any,
        message: string,
        classification: {
          primaryIntent: string;
          matchedIntents: string[];
          scores: Record<string, number>;
          isMeaningful: boolean;
        } | null,
        memory: null,
        pageKey: string,
      ) => { content: string; actions: Array<{ label: string }> };
    }).buildUnsupportedReply(
      clientUser,
      baseContext,
      'I want a sex party',
      {
        primaryIntent: 'unsupported_request',
        matchedIntents: ['unsupported_request'],
        scores: {},
        isMeaningful: true,
      },
      null,
      'workspace-dashboard',
    );

    expect(result.content).toContain("can't help with that request");
    expect(result.content).not.toContain('corporate event');
    expect(result.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining(['Rewrite request', 'Show supported event types']),
    );
  });

  it('shows overdue, unread, and blocked items for admins', async () => {
    const service = createService();

    jest.spyOn(service as any, 'getWorkspaceSnapshot').mockResolvedValue({
      unreadNotifications: 3,
      recentNotifications: [],
      recentAssistantActions: [],
      unreadThreads: 2,
      unreadMessages: 4,
      overduePayments: {
        count: 3,
        amount: 25000,
      },
      pendingPayments: {
        count: 3,
        amount: 25000,
      },
      pendingContracts: {
        count: 2,
        draftCount: 1,
        sentCount: 1,
      },
      awaitingSignatureCount: 1,
      pendingTasks: 5,
      overdueTasks: 2,
      upcomingEvent: null,
      activeProjects: 4,
      staffingGaps: 1,
      unassignedBookings: 2,
      stalledProjects: 1,
      missingUploads: 0,
    });

    const result = await (service as unknown as {
      buildWorkspaceSnapshotReply: (
        user: any,
        context: any,
        pageKey: string,
        memory: null,
      ) => Promise<{ content: string; actions: Array<{ label: string }> }>;
    }).buildWorkspaceSnapshotReply(adminUser, baseContext, 'workspace-dashboard', null);

    expect(result.content).toContain('unread chat');
    expect(result.content).toContain('overdue payment');
    expect(result.content).toContain('unassigned booking');
    expect(result.content).toContain('stalled project');
    expect(result.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining([
        'Draft reminder',
        'Show unread chats',
        'Show overdue payments',
        'Show blocked bookings',
      ]),
    );
  });

  it('escalates quickly when the user is frustrated', () => {
    const service = createService();
    const result = (service as unknown as {
      buildEscalationReply: (
        user: any,
        context: any,
        lead: null,
        project: null,
        message: string,
        classification: {
          primaryIntent: string;
          matchedIntents: string[];
          scores: Record<string, number>;
          isMeaningful: boolean;
          confidence?: number;
        },
        memory: {
          fallbackCount?: number;
        },
        pageKey: string,
      ) => { content: string; actions: Array<{ label: string }> };
    }).buildEscalationReply(
      clientUser,
      baseContext,
      null,
      null,
      'you are not helping',
      {
        primaryIntent: 'support_escalation',
        matchedIntents: ['support_escalation'],
        scores: {},
        isMeaningful: true,
        confidence: 0.2,
      },
      {
        fallbackCount: 1,
      },
      'workspace-dashboard',
    );

    expect(result.content).toContain('human handoff');
    expect(result.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining(['Send to team', 'Copy note']),
    );
  });
});

describe('assistant focused chat pass', () => {
  const focusedAdminUser = {
    userId: 'user-1',
    role: Role.ADMIN,
  } as const;

  const focusedClientUser = {
    userId: 'user-2',
    role: Role.CLIENT,
  } as const;

  const adminOperationalContext = {
    pagePath: '/admin',
    pageTitle: 'Dashboard',
    metadata: {
      section: 'general',
    },
  };

  const bookingContext = {
    pagePath: '/dashboard/bookings',
    pageTitle: 'Bookings',
    metadata: {
      section: 'booking',
    },
  };

  it('passes the greeting prompt with a short role-aware intro', async () => {
    const service = createService();
    const turn = await runTurn(
      service,
      focusedAdminUser,
      'hi',
      adminOperationalContext,
    );

    expect(turn.content).toContain("I'm Beer");
    expect(turn.content).toContain('overdue payments');
    expect(turn.content).not.toContain('dashboard is where');
    expect(turn.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining([
        'What needs attention?',
        'Show overdue payments',
        'Show unread chats',
        'Show blocked bookings',
      ]),
    );
  });

  it('answers identity prompts directly', async () => {
    const service = createService();
    const turn = await runTurn(
      service,
      focusedAdminUser,
      'who are you',
      adminOperationalContext,
    );

    expect(turn.content).toContain('in-site assistant');
    expect(turn.content).toContain('bookings');
    expect(turn.content).toContain('payments');
    expect(turn.content).toContain('chats');
    expect(turn.content).toContain('contracts');
    expect(turn.content).toContain('tasks');
    expect(turn.content.length).toBeLessThan(220);
  });

  it('answers capability prompts directly', async () => {
    const service = createService();
    const turn = await runTurn(
      service,
      focusedAdminUser,
      'what can you do',
      adminOperationalContext,
    );

    expect(turn.content).toContain('bookings');
    expect(turn.content).toContain('payments');
    expect(turn.content).toContain('contracts');
    expect(turn.content).toContain('unread chats');
    expect(turn.content).toContain('tasks');
    expect(turn.content.length).toBeLessThan(220);
    expect(turn.actions.length).toBeGreaterThan(0);
  });

  it('understands booking details in a single booking request', async () => {
    const service = createService();
    const turn = await runTurn(
      service,
      focusedClientUser,
      'I need a Hyderabad office event for 70 people, indoor, with snacks, and lower budget',
      bookingContext,
    );

    expect(turn.content).toContain('Hyderabad');
    expect(turn.content).toContain('office event');
    expect(turn.content).toContain('70 guests');
    expect(turn.content).toContain('indoor');
    expect(turn.content).toContain('snacks');
    expect(turn.content).toContain('leaner setup');
    expect(turn.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining([
        'Estimate cheaper package',
        'Make it cheaper',
        'Keep indoor setup',
        'Add snacks',
      ]),
    );
  });

  it('uses AI understanding to normalize a mixed-language follow-up', async () => {
    const service = createService({
      normalizedMessage: 'Make it cheaper instead.',
      primaryIntent: 'booking_follow_up',
      secondaryIntents: ['budget_discussion'],
      queryType: 'follow_up',
      timeframe: '',
      clarificationNeeded: false,
      clarificationQuestion: '',
      followUpContext: 'Same Hyderabad booking',
      language: 'Mixed language',
      sentiment: 'neutral',
      frustration: false,
      ambiguity: 'low',
      confidence: 0.93,
      entities: {
        budgetPreference: 'lower',
      },
    });

    const previousMemory = advanceMemory(
      null,
      focusedClientUser,
      'I need a Hyderabad corporate event for 50 people',
      bookingContext,
      [],
    );

    const result = await (
      service as unknown as {
        prepareAssistantTurnState: (input: {
          user: typeof focusedClientUser;
          message: string;
          context: AssistantContextInput;
          history: AssistantHistoryEntry[];
          previousMemory: AssistantConversationMemory | null;
        }) => Promise<{
          analysisMessage: string;
          classification: AssistantClassification;
          entities: AssistantExtractedEntities;
          understanding: AssistantLlmUnderstandingOutput | null;
        }>;
      }
    ).prepareAssistantTurnState({
      user: focusedClientUser,
      message: 'budget thoda kam karo',
      context: bookingContext,
      history: [
        {
          actor: 'USER',
          content: 'I need a Hyderabad corporate event for 50 people',
        },
      ],
      previousMemory,
    });

    expect(result.analysisMessage).toBe('Make it cheaper instead.');
    expect(result.understanding?.language).toBe('Mixed language');
    expect(result.classification.matchedIntents).toContain(
      'booking_follow_up',
    );
    expect(result.entities.budgetPreference).toBe('lower');
  });

  it('normalizes a Hinglish booking brief before deterministic extraction', async () => {
    const service = createService({
      normalizedMessage: 'I need a Hyderabad corporate event for 50 people.',
      primaryIntent: 'booking_inquiry',
      secondaryIntents: ['budget_discussion'],
      queryType: 'booking',
      timeframe: '',
      clarificationNeeded: false,
      clarificationQuestion: '',
      followUpContext: '',
      language: 'Hinglish',
      sentiment: 'neutral',
      frustration: false,
      ambiguity: 'low',
      confidence: 0.96,
      entities: {
        city: 'Hyderabad',
        guestCount: 50,
        eventType: 'corporate event',
        budgetPreference: 'lower',
        indoorOutdoor: 'indoor',
      },
    });

    const result = await (
      service as unknown as {
        prepareAssistantTurnState: (input: {
          user: typeof focusedClientUser;
          message: string;
          context: AssistantContextInput;
          history: AssistantHistoryEntry[];
          previousMemory: AssistantConversationMemory | null;
        }) => Promise<{
          analysisMessage: string;
          classification: AssistantClassification;
          entities: AssistantExtractedEntities;
          understanding: AssistantLlmUnderstandingOutput | null;
        }>;
      }
    ).prepareAssistantTurnState({
      user: focusedClientUser,
      message: 'Mujhe Hyderabad mein 50 logon ka corporate event chahiye',
      context: bookingContext,
      history: [],
      previousMemory: null,
    });

    expect(result.analysisMessage).toBe(
      'I need a Hyderabad corporate event for 50 people.',
    );
    expect(result.understanding?.language).toBe('Hinglish');
    expect(result.classification.matchedIntents).toContain(
      'booking_inquiry',
    );
    expect(result.entities.city).toBe('Hyderabad');
    expect(result.entities.guestCount).toBe(50);
  });

  it('answers a Hinglish unread chats prompt as a real operational summary', async () => {
    const service = createService({
      normalizedMessage: 'Show unread chats.',
      primaryIntent: 'unread_messages_help',
      secondaryIntents: ['operational_summary'],
      queryType: 'operational',
      timeframe: '',
      clarificationNeeded: false,
      clarificationQuestion: '',
      followUpContext: '',
      language: 'Hinglish',
      sentiment: 'neutral',
      frustration: false,
      ambiguity: 'low',
      confidence: 0.95,
      entities: {},
    });

    const turn = await runTurn(
      service,
      focusedAdminUser,
      'Unread chats dikhao',
      adminOperationalContext,
    );

    expect(turn.content).toContain('unread chat threads');
    expect(turn.content).toContain('unread notifications');
    expect(turn.content).not.toContain('Try');
    expect(turn.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining(['Show unread chats', 'Show alerts']),
    );
  });

  it('keeps the same booking context when the user upgrades to premium', async () => {
    const service = createService();
    const history: AssistantHistoryEntry[] = [];
    let memory: AssistantConversationMemory | null = null;

    const firstMessage = 'I need a Hyderabad corporate event for 50 people';
    const firstTurn = await runTurn(
      service,
      focusedClientUser,
      firstMessage,
      bookingContext,
      memory,
      history,
    );
    memory = advanceMemory(
      memory,
      focusedClientUser,
      firstMessage,
      bookingContext,
      history,
    );

    history.push(
      { actor: 'USER', content: firstMessage },
      { actor: 'ASSISTANT', content: firstTurn.content },
    );

    const followUpMessage = 'make it premium instead';
    const followUpTurn = await runTurn(
      service,
      focusedClientUser,
      followUpMessage,
      bookingContext,
      memory,
      history,
    );

    expect(followUpTurn.content).toContain('more premium');
    expect(followUpTurn.content).not.toContain('50 guests');
    expect(followUpTurn.content).not.toContain('Hyderabad');
    expect(followUpTurn.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining(['Make it premium']),
    );
  });

  it('refuses an unsupported request and redirects to a respectful supported format', async () => {
    const service = createService();
    const turn = await runTurn(
      service,
      focusedClientUser,
      'I need a sex party with my girlfriend',
      bookingContext,
    );

    expect(turn.content).toContain('private celebration');
    expect(turn.content).not.toContain('corporate event');
    expect(turn.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining(['Rewrite request', 'Show supported event types']),
    );
  });

  it('returns a real operational summary with counts and priorities', async () => {
    const service = createService();
    const turn = await runTurn(
      service,
      focusedAdminUser,
      'give me an operational summary',
      adminOperationalContext,
    );

    expect(turn.content).toContain('4 overdue payments');
    expect(turn.content).toContain('2 unsigned contracts');
    expect(turn.content).toContain('3 bookings without staff');
    expect(turn.content).toContain('Hyderabad Office Event');
    expect(turn.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining([
        'Show overdue payments',
        'Show unsigned contracts',
        'Show blocked bookings',
        'Show unread chats',
      ]),
    );
  });

  it('returns real pending task categories instead of a generic help prompt', async () => {
    const service = createService();
    const turn = await runTurn(
      service,
      focusedAdminUser,
      'what are the current pending tasks',
      adminOperationalContext,
    );

    expect(turn.content).toContain('open task');
    expect(turn.content).toContain('Hyderabad Office Event setup task');
    expect(turn.content).not.toContain('I can help with');
    expect(turn.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining(['Show pending tasks']),
    );
  });

  it('returns upcoming bookings in severity order with reasons', async () => {
    const service = createService();
    const turn = await runTurn(
      service,
      focusedAdminUser,
      'show upcoming bookings needing attention',
      adminOperationalContext,
    );

    expect(turn.content).toContain('upcoming booking');
    expect(turn.content).toContain('Hyderabad Office Event');
    expect(turn.content).toContain('Missing bartender assignment');
    expect(turn.content).toContain('Delhi Wedding');
    expect(turn.content.indexOf('Hyderabad Office Event')).toBeLessThan(
      turn.content.indexOf('Delhi Wedding'),
    );
    expect(turn.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining(['Show upcoming bookings']),
    );
  });

  it('returns overdue payments, unsigned contracts, and overdue tasks', async () => {
    const service = createService();
    const turn = await runTurn(
      service,
      focusedAdminUser,
      'what is overdue',
      adminOperationalContext,
    );

    expect(turn.content).toContain('overdue payment');
    expect(turn.content).toContain('unsigned contract');
    expect(turn.content).toContain('overdue task');
  });

  it('returns unread client chats with top threads', async () => {
    const service = createService();
    const turn = await runTurn(
      service,
      focusedAdminUser,
      'do I have unread client chats',
      adminOperationalContext,
    );

    expect(turn.content).toContain('unread chat thread');
    expect(turn.content).toContain('Hyderabad Office Event chat');
    expect(turn.content).toContain('Delhi Wedding chat');
    expect(turn.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining(['Show unread chats']),
    );
  });

  it('stops repeating when the user is frustrated', async () => {
    const service = createService();
    const turn = await runTurn(
      service,
      focusedClientUser,
      'you are not helping',
      bookingContext,
    );

    expect(turn.content).toContain('human handoff');
    expect(turn.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining(['Send to team', 'Copy note']),
    );
  });

  it('keeps the same booking context across multiple follow-ups', async () => {
    const service = createService();
    const history: AssistantHistoryEntry[] = [];
    let memory: AssistantConversationMemory | null = null;

    const firstMessage = 'I need a Hyderabad corporate event for 50 people';
    const firstTurn = await runTurn(
      service,
      focusedClientUser,
      firstMessage,
      bookingContext,
      memory,
      history,
    );
    memory = advanceMemory(
      memory,
      focusedClientUser,
      firstMessage,
      bookingContext,
      history,
    );
    history.push(
      { actor: 'USER', content: firstMessage },
      { actor: 'ASSISTANT', content: firstTurn.content },
    );

    const snackMessage = 'also add snacks';
    const snackTurn = await runTurn(
      service,
      focusedClientUser,
      snackMessage,
      bookingContext,
      memory,
      history,
    );
    memory = advanceMemory(
      memory,
      focusedClientUser,
      snackMessage,
      bookingContext,
      history,
    );
    history.push(
      { actor: 'USER', content: snackMessage },
      { actor: 'ASSISTANT', content: snackTurn.content },
    );

    const cheaperMessage = 'make it cheaper';
    const cheaperTurn = await runTurn(
      service,
      focusedClientUser,
      cheaperMessage,
      bookingContext,
      memory,
      history,
    );
    memory = advanceMemory(
      memory,
      focusedClientUser,
      cheaperMessage,
      bookingContext,
      history,
    );
    history.push(
      { actor: 'USER', content: cheaperMessage },
      { actor: 'ASSISTANT', content: cheaperTurn.content },
    );

    const indoorMessage = 'keep it indoor';
    const indoorTurn = await runTurn(
      service,
      focusedClientUser,
      indoorMessage,
      bookingContext,
      memory,
      history,
    );

    expect(firstTurn.content).toContain('Hyderabad');
    expect(firstTurn.content).toContain('50 guests');
    expect(snackTurn.content).toContain('snacks');
    expect(snackTurn.content).not.toContain('50 guests');
    expect(cheaperTurn.content).toContain('cheaper');
    expect(cheaperTurn.content).not.toContain('50 guests');
    expect(indoorTurn.content).toContain('indoor');
    expect(indoorTurn.content).not.toContain('50 guests');
  });

  it('returns a calm empty state when nothing needs attention', async () => {
    const service = createService();
    const operationalService = (service as any).operationalService as {
      getOperationalSummary: jest.Mock;
    };
    operationalService.getOperationalSummary.mockResolvedValue(
      makeEmptyOperationalSummary(),
    );

    const turn = await runTurn(
      service,
      focusedAdminUser,
      'what needs attention',
      adminOperationalContext,
    );

    expect(turn.content).toContain('Everything looks clean right now');
    expect((turn.metadata?.operationalTopIssues as string[] | undefined) ?? [])
      .toEqual([]);
    expect(turn.actions.map((action) => action.label)).toEqual(
      expect.arrayContaining([
        'Show upcoming bookings',
        'Open projects',
        'Show unread chats',
      ]),
    );
  });
});
