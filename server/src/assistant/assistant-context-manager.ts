import type { Role } from '@prisma/client';
import type {
  AssistantClassification,
  AssistantConversationMemory,
  AssistantExtractedEntities,
  AssistantHistoryEntry,
} from './assistant-engine.types';
import { buildAssistantMetadata } from './assistant-memory-manager';
import type { AssistantContextInput } from './assistant.types';

function readMetadataString(
  context: AssistantContextInput,
  key: string,
): string | null {
  return typeof context.metadata?.[key] === 'string'
    ? context.metadata[key]
    : null;
}

export function normalizeAssistantContext(
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

export function deriveAssistantSection(context: AssistantContextInput) {
  const currentTab = readMetadataString(context, 'currentTab');
  const currentView = readMetadataString(context, 'currentView');
  const surface = currentTab ?? currentView;

  if (surface) {
    if (['overview', 'summary'].includes(surface)) return 'general';
    if (['timeline', 'updates'].includes(surface)) return 'timeline';
    if (['payments', 'billing', 'receipts'].includes(surface))
      return 'payments';
    if (['contracts', 'agreement'].includes(surface)) return 'contracts';
    if (['chat', 'messages', 'inbox'].includes(surface)) return 'chat';
    if (['documents', 'files', 'uploads'].includes(surface)) return 'documents';
  }

  return typeof context.metadata?.section === 'string'
    ? context.metadata.section
    : 'general';
}

export function deriveAssistantPageKey(
  role: Role,
  pagePath?: string,
  context?: AssistantContextInput,
) {
  const path = pagePath ?? '';
  const section = context ? deriveAssistantSection(context) : 'general';

  if (
    path === '/dashboard' ||
    path === '/admin' ||
    path === '/staff' ||
    path === '/vendor'
  ) {
    return 'workspace-dashboard';
  }

  if (path.includes('/dashboard/events/')) {
    if (section === 'payments') return 'client-event-payments';
    if (section === 'contracts') return 'client-event-contracts';
    if (section === 'chat') return 'client-event-chat';
    return 'client-event-detail';
  }
  if (path.includes('/dashboard/bookings')) return 'client-bookings';
  if (path.includes('/dashboard/chat')) return 'client-chat';
  if (path.includes('/admin/bookings/')) return 'admin-booking-detail';
  if (path.includes('/admin/bookings')) return 'admin-bookings';
  if (path.includes('/admin/payments')) return 'admin-payments';
  if (path.includes('/admin/contracts')) return 'admin-contracts';
  if (path.includes('/admin/chat')) return 'admin-chat';
  if (path.includes('/staff/projects/')) return 'staff-project-detail';
  if (path.includes('/staff/bookings/')) return 'staff-booking-detail';
  if (path.includes('/staff/tasks')) return 'staff-tasks';
  if (path.includes('/staff/chat') || path.includes('/staff/inbox'))
    return 'staff-chat';
  if (path.includes('/vendor/projects/')) return 'vendor-project-detail';
  if (path.includes('/vendor')) return 'vendor-workspace';

  if (role === 'CLIENT' || role === 'VENDOR' || role === 'ADMIN') {
    return 'general';
  }

  return 'general';
}

export function contextHasValues(input: AssistantContextInput) {
  return Boolean(
    input.pagePath ||
    input.pageTitle ||
    input.bookingId ||
    input.leadId ||
    input.projectId ||
    (input.metadata && Object.keys(input.metadata).length),
  );
}

export function attachAssistantStateToContext(input: {
  context: AssistantContextInput;
  history: AssistantHistoryEntry[];
  memory: AssistantConversationMemory;
  classification: AssistantClassification;
  entities: AssistantExtractedEntities;
  understanding?: Record<string, unknown> | null;
}) {
  return {
    ...input.context,
    metadata: buildAssistantMetadata({
      existing: input.context.metadata,
      history: input.history,
      memory: input.memory,
      classification: input.classification,
      entities: input.entities,
      understanding: input.understanding ?? null,
    }),
  } satisfies AssistantContextInput;
}
