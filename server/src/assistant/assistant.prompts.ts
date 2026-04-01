import { Role } from '@prisma/client';
import type { AssistantPromptSuggestion } from './assistant.types';

type PromptMap = Record<string, AssistantPromptSuggestion[]>;

function buildPrompt(
  id: string,
  title: string,
  prompt: string,
  description: string,
): AssistantPromptSuggestion {
  return {
    id,
    title,
    prompt,
    description,
  };
}

const clientPrompts: PromptMap = {
  general: [
    buildPrompt(
      'client-booking-summary',
      'Summarize booking',
      'Summarize this booking',
      'Turn the current booking into a short client-friendly brief.',
    ),
    buildPrompt(
      'client-contract-status',
      'Contract status',
      'Explain the contract status',
      'Explain what stage the agreement is in and what happens next.',
    ),
    buildPrompt(
      'client-payment-summary',
      'Pending payments',
      'Show pending payments for this booking',
      'Highlight what is unpaid, overdue, or due next.',
    ),
    buildPrompt(
      'client-draft-followup',
      'Draft follow-up',
      'Draft a follow-up message for this booking',
      'Generate a polished client-side follow-up draft.',
    ),
  ],
  'workspace-dashboard': [
    buildPrompt(
      'client-dashboard-next',
      'Next actions',
      'What is pending for me right now?',
      'Surface the most relevant contract, payment, chat, and planning actions.',
    ),
    buildPrompt(
      'client-dashboard-next-event',
      'Next event',
      'Show my next event',
      'Find the nearest confirmed event and the clean next move.',
    ),
  ],
  'client-event-detail': [
    buildPrompt(
      'client-event-summary',
      'Summarize booking',
      'Summarize this booking',
      'Condense the event into a short premium brief.',
    ),
    buildPrompt(
      'client-event-pending',
      'What is pending?',
      'What is pending here?',
      'List contract, payment, chat, and planning blockers on this event.',
    ),
    buildPrompt(
      'client-event-draft',
      'Draft message',
      'Draft message to the team about this booking',
      'Write a polished update using the current event context.',
    ),
    buildPrompt(
      'client-event-contract',
      'Contract status',
      'Show contract status for this booking',
      'Explain the agreement stage and what is still required.',
    ),
  ],
  'client-event-payments': [
    buildPrompt(
      'client-event-payments-overdue',
      'Overdue invoices',
      'Which milestone is overdue?',
      'Highlight overdue or failed milestones on this event.',
    ),
    buildPrompt(
      'client-event-payments-summary',
      'Payment history',
      'Summarize payment history',
      'Break down paid, pending, and remaining amounts.',
    ),
    buildPrompt(
      'client-event-payments-reminder',
      'Draft reminder',
      'Draft payment reminder',
      'Generate a polished payment reminder draft.',
    ),
  ],
  'client-event-contracts': [
    buildPrompt(
      'client-event-contract-summary',
      'Summarize contract',
      'Summarize this contract',
      'Explain the agreement stage, revisions, and next signature step.',
    ),
    buildPrompt(
      'client-event-contract-version',
      'Latest version',
      'Show latest contract version',
      'Surface the latest uploaded version and revision count.',
    ),
    buildPrompt(
      'client-event-contract-followup',
      'Draft contract follow-up',
      'Draft contract follow-up',
      'Write a concise follow-up for the agreement stage.',
    ),
  ],
  'client-event-chat': [
    buildPrompt(
      'client-event-chat-unread',
      'Unread summary',
      'Summarize unread messages',
      'Condense recent unread chat messages and the next action.',
    ),
    buildPrompt(
      'client-event-chat-draft',
      'Draft reply',
      'Draft reply for this chat',
      'Write a short polished response for this booking chat.',
    ),
    buildPrompt(
      'client-event-chat-related',
      'Related booking',
      'Show related booking summary',
      'Pull the related booking context into the conversation.',
    ),
  ],
};

const adminPrompts: PromptMap = {
  general: [
    buildPrompt(
      'admin-pending-ops',
      'Pending approvals',
      'What needs attention?',
      'Surface commercial, contract, payment, staffing, and chat blockers.',
    ),
    buildPrompt(
      'admin-unread-chats',
      'Unread messages',
      'Show unread client chats',
      'Jump to the threads that need a response first.',
    ),
    buildPrompt(
      'admin-overdue-payments',
      'Overdue payments',
      'Show overdue payments',
      'Highlight overdue collections and the amount at risk.',
    ),
    buildPrompt(
      'admin-staffing-gaps',
      'Staffing gaps',
      'Show bookings with staffing gaps',
      'Find active bookings with weak assignment coverage.',
    ),
  ],
  'workspace-dashboard': [
    buildPrompt(
      'admin-dashboard-summary',
      'Operations summary',
      'Give me an operational summary',
      'Summarize unread chats, overdue payments, pending contracts, and coverage gaps.',
    ),
    buildPrompt(
      'admin-dashboard-upcoming',
      'Upcoming bookings',
      'Show upcoming bookings needing attention',
      'Pull the nearest bookings with pending actions.',
    ),
  ],
  'admin-booking-detail': [
    buildPrompt(
      'admin-booking-summary',
      'Summarize booking',
      'Summarize this booking',
      'Turn the booking into a short operational brief.',
    ),
    buildPrompt(
      'admin-booking-pending',
      'Pending actions',
      'What is pending here?',
      'List payments, contracts, unread messages, documents, and staffing blockers.',
    ),
    buildPrompt(
      'admin-booking-draft',
      'Draft client reply',
      'Draft message to client',
      'Write a polished client update from the current booking context.',
    ),
    buildPrompt(
      'admin-booking-contract',
      'Contract status',
      'Summarize this contract',
      'Explain the contract stage, latest version, and revision count.',
    ),
  ],
  'admin-payments': [
    buildPrompt(
      'admin-payments-overdue',
      'Overdue invoices',
      'Show overdue invoices',
      'Highlight overdue collections across visible payments.',
    ),
    buildPrompt(
      'admin-payments-history',
      'Payment history',
      'Summarize payment history',
      'Break down paid, pending, failed, and refunded milestones.',
    ),
    buildPrompt(
      'admin-payments-reminder',
      'Draft reminder',
      'Draft payment reminder',
      'Generate a client-ready reminder for the selected payment context.',
    ),
  ],
  'admin-contracts': [
    buildPrompt(
      'admin-contracts-summary',
      'Summarize contracts',
      'Summarize pending contracts',
      'Explain which contracts need issue, signature, or archival movement.',
    ),
    buildPrompt(
      'admin-contracts-version',
      'Latest version',
      'Show latest contract version',
      'Surface revision count and the latest uploaded version.',
    ),
    buildPrompt(
      'admin-contracts-followup',
      'Draft contract follow-up',
      'Draft contract follow-up',
      'Write a polished agreement follow-up for the client.',
    ),
  ],
  'admin-chat': [
    buildPrompt(
      'admin-chat-unread',
      'Unread summary',
      'Summarize unread messages',
      'Condense unread threads into the most urgent client actions.',
    ),
    buildPrompt(
      'admin-chat-draft',
      'Draft reply',
      'Draft reply to client',
      'Generate a polished reply for the active conversation.',
    ),
  ],
};

const staffPrompts: PromptMap = {
  general: [
    buildPrompt(
      'staff-assigned-bookings',
      'Assigned bookings',
      'Show my assigned bookings',
      'Pull the bookings and projects already assigned to you.',
    ),
    buildPrompt(
      'staff-unread',
      'Unread chats',
      'Show unread chats',
      'Surface the messages that need a reply first.',
    ),
    buildPrompt(
      'staff-pending-tasks',
      'Pending tasks',
      'Show pending tasks',
      'Highlight open tasks, missing uploads, and delivery blockers.',
    ),
    buildPrompt(
      'staff-payment-followup',
      'Payment follow-up',
      'Show payment follow-up needed',
      'Point out bookings where commercial follow-up is still blocking ops.',
    ),
  ],
  'workspace-dashboard': [
    buildPrompt(
      'staff-dashboard-summary',
      'Ops snapshot',
      'What needs my attention today?',
      'Summarize assigned bookings, unread chats, overdue tasks, and upload gaps.',
    ),
  ],
  'staff-project-detail': [
    buildPrompt(
      'staff-project-summary',
      'Summarize project',
      'Summarize this project',
      'Condense timeline, ownership, uploads, and risks.',
    ),
    buildPrompt(
      'staff-project-tasks',
      'Pending tasks',
      'Show pending tasks',
      'Highlight open execution work and blockers on this project.',
    ),
    buildPrompt(
      'staff-project-draft',
      'Draft update',
      'Draft staff assignment update',
      'Write a short internal update for the active project.',
    ),
  ],
  'staff-booking-detail': [
    buildPrompt(
      'staff-booking-pending',
      'Pending actions',
      'What is pending here?',
      'List payment, contract, timeline, and chat blockers for this booking.',
    ),
    buildPrompt(
      'staff-booking-chat',
      'Draft reply',
      'Draft reply to client',
      'Generate a clean response for the active booking context.',
    ),
  ],
  'staff-chat': [
    buildPrompt(
      'staff-chat-summary',
      'Unread summary',
      'Summarize unread messages',
      'Condense unread threads into priority actions.',
    ),
    buildPrompt(
      'staff-chat-draft',
      'Draft reply',
      'Draft reply',
      'Write a polished client-facing reply for the active chat.',
    ),
  ],
  'staff-tasks': [
    buildPrompt(
      'staff-tasks-priority',
      'Priority tasks',
      'Show my priority tasks',
      'Surface overdue and high-priority tasks first.',
    ),
    buildPrompt(
      'staff-tasks-uploads',
      'Missing uploads',
      'Show missing uploads',
      'Find tasks and projects still waiting for files or handoff docs.',
    ),
  ],
};

const vendorPrompts: PromptMap = {
  general: [
    buildPrompt(
      'vendor-next-assignment',
      'Next assignment',
      'Show my next assignment',
      'Pull the next confirmed event with schedule context.',
    ),
    buildPrompt(
      'vendor-payment-release',
      'Payment release',
      'Show payment release status',
      'Highlight pending commercial release details on active assignments.',
    ),
    buildPrompt(
      'vendor-upload-reminder',
      'Upload reminders',
      'Show missing uploads',
      'Find deliverables or files still missing from your side.',
    ),
    buildPrompt(
      'vendor-deadlines',
      'Delivery deadlines',
      'Show event deadlines',
      'Summarize upcoming event timing and delivery deadlines.',
    ),
  ],
  'workspace-dashboard': [
    buildPrompt(
      'vendor-dashboard-summary',
      'Vendor summary',
      'What needs my attention today?',
      'Summarize upcoming events, payment release, missing uploads, and deadlines.',
    ),
  ],
  'vendor-project-detail': [
    buildPrompt(
      'vendor-project-summary',
      'Summarize project',
      'Summarize this project',
      'Condense event schedule, uploads, payment status, and next delivery move.',
    ),
    buildPrompt(
      'vendor-project-payments',
      'Payment release',
      'Summarize payment status',
      'Explain paid, pending, and unreleased payment milestones.',
    ),
    buildPrompt(
      'vendor-project-update',
      'Draft update',
      'Draft update for ops',
      'Write a concise vendor-side update for ops or coordination.',
    ),
  ],
  'vendor-workspace': [
    buildPrompt(
      'vendor-workspace-events',
      'Assigned events',
      'Show my assigned events',
      'Pull the active event list and the nearest deadline.',
    ),
  ],
};

export function getDefaultPromptSuggestions(
  role: Role,
  pageKey: string,
): AssistantPromptSuggestion[] {
  const source =
    role === Role.CLIENT
      ? clientPrompts
      : role === Role.VENDOR
        ? vendorPrompts
        : role === Role.ADMIN
          ? adminPrompts
          : staffPrompts;

  const pageSpecific = pageKey === 'general' ? [] : (source[pageKey] ?? []);
  return [...pageSpecific, ...(source.general ?? [])].slice(0, 6);
}
