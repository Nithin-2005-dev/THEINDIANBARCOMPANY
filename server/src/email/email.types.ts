import type { Prisma } from '@prisma/client';

export const EMAIL_RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
] as const;

export const EMAIL_MAX_RETRIES = EMAIL_RETRY_DELAYS_MS.length;

export type EmailQueuePayload = {
  to: string;
  subject: string;
  template: string;
  variables?: Record<string, unknown>;
  emailType?: string;
  metadata?: Prisma.InputJsonValue;
  recipientUserId?: string;
  requestedById?: string;
  leadId?: string;
  projectId?: string;
  paymentId?: string;
  proposalId?: string;
  contractId?: string;
  allowManualResend?: boolean;
  isSensitive?: boolean;
};

export type EmailDispatchResult = {
  delivered: boolean;
  provider: string;
  providerMessageId?: string | null;
  providerAcknowledgedAt?: Date | null;
  providerResponse?: Prisma.JsonValue | null;
};

const sensitiveKeyFragments = [
  'otp',
  'token',
  'secret',
  'password',
  'authorization',
  'accesskey',
  'access_token',
  'refreshkey',
  'refresh_token',
];

const templateEmailTypeMap: Record<string, string> = {
  'contract-ready': 'CONTRACT_READY',
  'contract-signed': 'CONTRACT_SIGNED',
  'event-reminder': 'EVENT_REMINDER',
  'lead-admin-notification': 'ADMIN_ALERT',
  'lead-confirmation': 'BOOKING_CONFIRMATION',
  'otp-login': 'LOGIN_OTP',
  'payment-receipt': 'PAYMENT_RECEIPT',
  'payment-reminder': 'PAYMENT_REMINDER',
  'project-update': 'PROJECT_UPDATE',
  'proposal-accepted': 'PROPOSAL_ACCEPTED',
  'proposal-rejected': 'PROPOSAL_REJECTED',
  'proposal-sent': 'PROPOSAL_SENT',
};

export function inferEmailType(template: string, explicitType?: string | null) {
  return explicitType?.trim() || templateEmailTypeMap[template] || 'GENERAL';
}

export function containsSensitiveEmailVariables(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => containsSensitiveEmailVariables(entry));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, entryValue]) => {
      const normalizedKey = key.toLowerCase();
      if (
        sensitiveKeyFragments.some((fragment) =>
          normalizedKey.includes(fragment),
        )
      ) {
        return true;
      }

      return containsSensitiveEmailVariables(entryValue);
    });
  }

  return false;
}

export function redactEmailVariables(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactEmailVariables(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => {
        const normalizedKey = key.toLowerCase();
        const shouldRedact = sensitiveKeyFragments.some((fragment) =>
          normalizedKey.includes(fragment),
        );

        return [
          key,
          shouldRedact ? '[REDACTED]' : redactEmailVariables(entryValue),
        ];
      }),
    );
  }

  return value;
}

export function getEmailRetryDelayMs(attemptNumber: number) {
  return EMAIL_RETRY_DELAYS_MS[attemptNumber - 1] ?? null;
}
