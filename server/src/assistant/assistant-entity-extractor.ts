import type { ContractStatus, PaymentStatus } from '@prisma/client';
import type {
  AssistantEntityExtractorInput,
  AssistantExtractedEntities,
} from './assistant-engine.types';
import {
  detectAlcoholPreference,
  detectBudgetPreference,
  detectPrivateCelebrationRequest,
  detectUnsupportedRequest,
  normalizeAssistantText,
} from './assistant-language';

const SERVICE_ALIASES = [
  {
    slug: 'martini',
    aliases: [
      'martini',
      'house party',
      'house-party',
      'houseparty',
      'home party',
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
    aliases: ['negroni', 'pool party', 'pool-party', 'poolparty', 'poolside'],
  },
  {
    slug: 'corporate',
    aliases: [
      'corporate',
      'corporate event',
      'office event',
      'office party',
      'work event',
      'team event',
      'cosmo',
    ],
  },
  {
    slug: 'festival',
    aliases: [
      'festival',
      'public event',
      'concert',
      'crowd event',
      'festival event',
      'bloody mary',
      'bm',
    ],
  },
] as const;

const OCCASIONS = [
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
] as const;

const MAJOR_CITIES = [
  'bangalore',
  'bengaluru',
  'hyderabad',
  'mumbai',
  'delhi',
  'gurgaon',
  'gurugram',
  'noida',
  'pune',
  'chennai',
  'kolkata',
  'kochi',
  'goa',
  'ahmedabad',
  'jaipur',
  'lucknow',
  'indore',
  'surat',
] as const;

const VENUE_TYPES = [
  'office',
  'home',
  'house',
  'pool',
  'hotel',
  'banquet',
  'banquet hall',
  'resort',
  'farmhouse',
  'club',
  'rooftop',
  'outdoor venue',
] as const;

function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function parseBudgetAmount(message: string) {
  const normalized = normalizeAssistantText(message);

  if (/\b(a|one)\s+lakh\b/.test(normalized)) {
    return 100000;
  }

  const lakhMatch = normalized.match(
    /(?:\u20b9|rs\.?|inr|rupees?|rupee)?\s*(\d+(?:\.\d+)?)\s*lakh\b/,
  );
  if (lakhMatch) {
    return Math.round(Number(lakhMatch[1]) * 100000);
  }

  const thousandMatch = normalized.match(
    /(?:\u20b9|rs\.?|inr|rupees?|rupee)?\s*(\d+(?:\.\d+)?)\s*k\b/,
  );
  if (thousandMatch) {
    return Math.round(Number(thousandMatch[1]) * 1000);
  }

  const rupeeMatch = normalized.match(
    /(?:\u20b9|rs\.?|inr|rupees?|rupee)?\s*([\d,]{4,9})\b/,
  );
  if (rupeeMatch) {
    const digits = Number(rupeeMatch[1].replace(/,/g, ''));
    return Number.isNaN(digits) ? null : digits;
  }

  return null;
}

function parseGuestCount(message: string) {
  const normalized = normalizeAssistantText(message);
  const match = normalized.match(
    /\b(?:for|around|about|roughly|approximately)?\s*(\d{1,4})\s*(guest|guests|people|pax|persons)\b/,
  );

  if (match) {
    return Number(match[1]);
  }

  return null;
}

function parseOccasion(message: string) {
  const normalized = normalizeAssistantText(message);
  const found = OCCASIONS.find((occasion) => normalized.includes(occasion));
  return found ? titleCase(found) : null;
}

function inferEventType(message: string) {
  const normalized = normalizeAssistantText(message);

  if (detectUnsupportedRequest(normalized)) {
    return null;
  }

  if (detectPrivateCelebrationRequest(normalized)) {
    return 'private celebration';
  }

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

function normalizeEventTypeHint(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = normalizeAssistantText(value);
  if (!normalized) {
    return undefined;
  }

  if (detectPrivateCelebrationRequest(normalized)) {
    return 'private celebration';
  }

  if (/\b(office|corporate|team|work|company)\b/.test(normalized)) {
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

  return undefined;
}

function inferServiceSlug(
  message: string,
  memoryServiceSlug?: string | null,
  contextServiceSlug?: string | null,
) {
  const normalized = normalizeAssistantText(message);

  if (detectUnsupportedRequest(normalized)) {
    return null;
  }

  const mapping = SERVICE_ALIASES.find((service) =>
    service.aliases.some((alias) => normalized.includes(String(alias))),
  );

  if (mapping) {
    return mapping.slug;
  }

  if (detectPrivateCelebrationRequest(normalized)) {
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

  return contextServiceSlug ?? memoryServiceSlug ?? null;
}

function parseCity(message: string) {
  const normalized = normalizeAssistantText(message);
  const explicitCity = MAJOR_CITIES.find((city) => normalized.includes(city));
  if (explicitCity) {
    return titleCase(explicitCity);
  }

  return null;
}

function parseVenueType(message: string) {
  const normalized = normalizeAssistantText(message);
  const found = VENUE_TYPES.find((venue) => normalized.includes(venue));
  return found ?? null;
}

function parseIndoorOutdoor(message: string) {
  const normalized = normalizeAssistantText(message);
  if (normalized.includes('indoor')) return 'indoor';
  if (normalized.includes('outdoor')) return 'outdoor';
  return null;
}

function parseFoodRequirement(message: string) {
  const normalized = normalizeAssistantText(message);
  if (/\b(snacks|snack)\b/.test(normalized)) return 'snacks';
  if (/\b(buffet|meal|dinner|lunch|brunch)\b/.test(normalized))
    return 'meal service';
  if (/\b(catering|catered|caterer)\b/.test(normalized)) return 'catering';
  if (/\b(food|eatables|bites|starters)\b/.test(normalized))
    return 'food support';
  return null;
}

function parseDrinkRequirement(message: string) {
  return detectAlcoholPreference(message);
}

function parseBudgetPreference(message: string) {
  return detectBudgetPreference(message);
}

function parseBookingStatus(message: string) {
  const normalized = normalizeAssistantText(message);

  if (/\b(won|confirmed|booked|locked)\b/.test(normalized)) return 'CONFIRMED';
  if (/\b(proposal sent|proposal shared)\b/.test(normalized))
    return 'PROPOSAL_SENT';
  if (/\b(new booking|new lead)\b/.test(normalized)) return 'NEW';
  if (/\b(negotiating|negotiation)\b/.test(normalized)) return 'NEGOTIATING';
  if (/\b(lost|cancelled|canceled)\b/.test(normalized)) return 'LOST';

  return null;
}

function parsePaymentStatus(message: string) {
  const normalized = normalizeAssistantText(message);

  if (
    /\b(overdue|unpaid|pending amount|balance|remaining amount|left to pay|owed|outstanding|due)\b/.test(
      normalized,
    )
  ) {
    return 'UNPAID' as const;
  }

  if (/\b(pending)\b/.test(normalized)) return 'PENDING' as const;
  if (/\b(paid|settled|completed)\b/.test(normalized)) return 'PAID' as const;
  if (/\b(failed|failure|declined)\b/.test(normalized))
    return 'FAILED' as const;
  if (/\b(refunded|refund)\b/.test(normalized)) return 'REFUNDED' as const;

  return null;
}

function parseContractStatus(message: string) {
  const normalized = normalizeAssistantText(message);

  if (/\b(contract draft|agreement draft|draft contract)\b/.test(normalized)) {
    return 'DRAFT' as const;
  }

  if (
    /\b(contract sent|agreement sent|awaiting signature)\b/.test(normalized)
  ) {
    return 'SENT' as const;
  }

  if (
    /\b(contract signed|agreement signed|signed agreement)\b/.test(normalized)
  ) {
    return 'SIGNED' as const;
  }

  if (/\b(archived)\b/.test(normalized)) return 'ARCHIVED' as const;
  if (/\b(cancelled|canceled)\b/.test(normalized)) return 'CANCELLED' as const;

  return null;
}

function normalizePaymentStatusHint(
  value: unknown,
): PaymentStatus | 'UNPAID' | 'OVERDUE' | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (
    normalized === 'PENDING' ||
    normalized === 'PAID' ||
    normalized === 'FAILED' ||
    normalized === 'REFUNDED' ||
    normalized === 'UNPAID' ||
    normalized === 'OVERDUE'
  ) {
    return normalized;
  }

  return undefined;
}

function normalizeServiceSlugHint(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = normalizeAssistantText(value);
  if (!normalized) {
    return undefined;
  }

  const mapping = SERVICE_ALIASES.find((service) =>
    service.slug === normalized ||
    service.aliases.some((alias) => normalized.includes(String(alias))),
  );

  return mapping?.slug;
}

function normalizeCityHint(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = normalizeAssistantText(value);
  if (!normalized) {
    return undefined;
  }

  const explicitCity = MAJOR_CITIES.find((city) => normalized.includes(city));
  return explicitCity ? titleCase(explicitCity) : undefined;
}

function normalizeContractStatusHint(
  value: unknown,
): ContractStatus | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (
    normalized === 'DRAFT' ||
    normalized === 'SENT' ||
    normalized === 'SIGNED' ||
    normalized === 'ARCHIVED' ||
    normalized === 'CANCELLED'
  ) {
    return normalized;
  }

  return undefined;
}

function getContextServiceSlug(input: AssistantEntityExtractorInput) {
  const metadataSlug =
    typeof input.context.metadata?.serviceSlug === 'string'
      ? input.context.metadata.serviceSlug
      : null;

  return metadataSlug ?? input.memory?.serviceSlug ?? null;
}

export function extractAssistantEntities(
  input: AssistantEntityExtractorInput,
): AssistantExtractedEntities {
  const understanding = input.understanding ?? null;
  const normalizedMessage =
    understanding?.normalizedMessage?.trim() || input.message;
  const budgetAmount =
    parseBudgetAmount(normalizedMessage) ??
    understanding?.entities?.budgetAmount ??
    undefined;
  const serviceSlug = inferServiceSlug(
    normalizedMessage,
    input.memory?.serviceSlug,
    getContextServiceSlug(input),
  ) ?? normalizeServiceSlugHint(understanding?.entities?.serviceSlug) ?? null;
  const guestCount =
    parseGuestCount(normalizedMessage) ??
    understanding?.entities?.guestCount ??
    undefined;
  const eventType =
    inferEventType(normalizedMessage) ??
    normalizeEventTypeHint(understanding?.entities?.eventType) ??
    input.memory?.eventType;
  const city =
    parseCity(normalizedMessage) ??
    normalizeCityHint(understanding?.entities?.city) ??
    input.memory?.city;
  const venueType =
    parseVenueType(normalizedMessage) ??
    understanding?.entities?.venueType ??
    input.memory?.venueType;
  const indoorOutdoor =
    parseIndoorOutdoor(normalizedMessage) ??
    understanding?.entities?.indoorOutdoor ??
    input.memory?.indoorOutdoor;
  const foodRequirement =
    parseFoodRequirement(normalizedMessage) ??
    understanding?.entities?.foodRequirement ??
    input.memory?.foodRequirement;
  const drinkRequirement =
    parseDrinkRequirement(normalizedMessage) ??
    understanding?.entities?.drinkRequirement ??
    input.memory?.drinkRequirement;
  const budgetPreference =
    parseBudgetPreference(normalizedMessage) ??
    understanding?.entities?.budgetPreference ??
    input.memory?.budgetPreference;

  return {
    eventType: eventType ?? undefined,
    occasion:
      parseOccasion(normalizedMessage) ??
      understanding?.entities?.occasion ??
      input.memory?.occasion,
    serviceSlug,
    budgetAmount,
    budgetText: budgetAmount
      ? formatCurrency(budgetAmount)
      : understanding?.entities?.budgetText ?? input.memory?.budgetText,
    budgetPreference,
    guestCount,
    city,
    location: city ?? input.memory?.location,
    venueType: venueType ?? undefined,
    indoorOutdoor: indoorOutdoor ?? undefined,
    foodRequirement: foodRequirement ?? undefined,
    drinkRequirement: drinkRequirement ?? undefined,
    bookingStatus:
      parseBookingStatus(normalizedMessage) ??
      understanding?.entities?.bookingStatus ??
      input.memory?.bookingStatus,
    paymentStatus:
      parsePaymentStatus(normalizedMessage) ??
      normalizePaymentStatusHint(understanding?.entities?.paymentStatus) ??
      (input.memory?.paymentStatus as PaymentStatus | undefined),
    contractStatus:
      parseContractStatus(normalizedMessage) ??
      normalizeContractStatusHint(understanding?.entities?.contractStatus) ??
      (input.memory?.contractStatus as ContractStatus | undefined),
    selectedBookingId:
      input.context.leadId ??
      input.context.bookingId ??
      input.memory?.selectedBookingId,
    selectedProjectId:
      input.context.projectId ?? input.memory?.selectedProjectId,
    currentPagePath: input.context.pagePath ?? input.memory?.currentPagePath,
    currentPageTitle: input.context.pageTitle ?? input.memory?.currentPageTitle,
    currentRole: input.role,
    asksForEstimate:
      Boolean(understanding?.entities?.asksForEstimate) ||
      /\b(estimate|budget estimate|cost estimate|quote)\b/i.test(
        normalizedMessage,
      ),
    asksForComparison:
      Boolean(understanding?.entities?.asksForComparison) ||
      /\b(compare|comparison|versus|vs)\b/i.test(normalizedMessage),
    asksForDraft:
      Boolean(understanding?.entities?.asksForDraft) ||
      /\b(draft|write|compose)\b/i.test(normalizedMessage),
  };
}
