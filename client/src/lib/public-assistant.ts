"use client"

import {
  BOOKING_STEPS,
  type BookingStep,
} from "@/components/booking/booking-flow"
import {
  buildBookingHref,
  bookingServices,
  resolveBookingService,
} from "@/components/booking/booking-service-config"
import { packagesData } from "@/data/packages"
import { services } from "@/data/services"
import type {
  AssistantAction,
  AssistantAnalyticsEvent,
  AssistantConversation,
  AssistantConversationContext,
  AssistantLiveTurnResponse,
  AssistantMessage,
  AssistantPromptSuggestion,
  AssistantTurnResponse,
} from "@/types/assistant"

type GuestSseHandlers = {
  onTurn?: (payload: Pick<AssistantTurnResponse, "conversation" | "userMessage">) => void
  onChunk?: (delta: string) => void
  onComplete?: (payload: AssistantTurnResponse) => void
}

type GuestLiveSseHandlers = {
  onTurn?: (payload: Pick<AssistantLiveTurnResponse, "userMessage">) => void
  onChunk?: (delta: string) => void
  onComplete?: (payload: AssistantLiveTurnResponse) => void
}

type StoredConversation = AssistantConversation & {
  context?: AssistantConversationContext
  messages: AssistantMessage[]
}

type PublicReply = {
  content: string
  actions: AssistantAction[]
}

type PublicHistoryEntry = {
  actor: AssistantMessage["actor"]
  content: string
}

type PublicIntent =
  | "greeting"
  | "informational_question"
  | "booking_inquiry"
  | "service_recommendation"
  | "budget_discussion"
  | "navigation_request"
  | "support_issue"
  | "escalation_request"

type BookingMemory = {
  occasion?: string
  eventType?: string
  serviceSlug?: string | null
  guestCount?: number
  budgetAmount?: number
  budgetText?: string
  venueHint?: string
  location?: string
  indoorOutdoor?: string
  needsFood?: boolean
  likelyInclusions: string[]
  missingDetails: string[]
}

type MarketingService = (typeof services)[number]
type PackageGroup = (typeof packagesData)[keyof typeof packagesData]

const STORAGE_KEY = "tib-beer-bear-public-conversations"
const GUEST_MESSAGE_METADATA = {
  mode: "public",
  concierge: "beer-the-bear",
} as const

const SERVICE_PACKAGE_KEYS = {
  martini: "martini",
  negroni: "negroni",
  corporate: "cosmo",
  festival: "bm",
} as const

const DEFAULT_PUBLIC_SUGGESTIONS: AssistantPromptSuggestion[] = [
  {
    id: "public-overview",
    title: "Find the right service",
    prompt: "Which service fits my event best?",
    description: "Quick guidance before you commit to a page or form.",
  },
  {
    id: "public-booking",
    title: "Start booking",
    prompt: "Take me to the booking flow",
    description: "Jump straight into the next practical step.",
  },
  {
    id: "public-pricing",
    title: "Pricing range",
    prompt: "What pricing range should I expect?",
    description: "A concise starting point for scope and budget.",
  },
]

function getNowIso() {
  return new Date().toISOString()
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function readStore() {
  if (typeof window === "undefined") {
    return [] as StoredConversation[]
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return [] as StoredConversation[]

  try {
    const parsed = JSON.parse(raw) as StoredConversation[]
    return parsed
      .map((conversation) => ({
        ...conversation,
        isArchived: Boolean(conversation.isArchived),
        archivedAt: conversation.archivedAt ?? null,
        isPinned: Boolean(conversation.isPinned),
        pinnedAt: conversation.pinnedAt ?? null,
        messages: Array.isArray(conversation.messages) ? conversation.messages : [],
      }))
      .sort(
        (left, right) =>
          Number(Boolean(right.isPinned)) - Number(Boolean(left.isPinned)) ||
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      )
  } catch {
    return [] as StoredConversation[]
  }
}

function writeStore(conversations: StoredConversation[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
}

function getPackageGroup(serviceSlug?: string | null): PackageGroup | null {
  const resolvedService = resolveBookingService(serviceSlug)
  if (!resolvedService) return null

  const packageKey = SERVICE_PACKAGE_KEYS[resolvedService.slug]
  return packagesData[packageKey] ?? null
}

function getMarketingService(serviceSlug?: string | null): MarketingService | null {
  const resolvedService = resolveBookingService(serviceSlug)
  if (!resolvedService?.marketingPath) return null

  const marketingSlug = resolvedService.marketingPath.replace(/^\//, "")
  return services.find((item) => item.id === marketingSlug) ?? null
}

function getServiceSlug(context?: AssistantConversationContext) {
  const metadataSlug =
    typeof context?.metadata?.serviceSlug === "string"
      ? context.metadata.serviceSlug
      : null

  if (metadataSlug) {
    return resolveBookingService(metadataSlug)?.slug ?? metadataSlug
  }

  if (!context?.pagePath) return null

  const direct = context.pagePath.split("/").filter(Boolean)[0]
  return resolveBookingService(direct)?.slug ?? null
}

function summarizeConversation(conversation: StoredConversation): AssistantConversation {
  return {
    id: conversation.id,
    title: conversation.title,
    preview: conversation.preview,
    messageCount: conversation.messages.length,
    isArchived: conversation.isArchived,
    archivedAt: conversation.archivedAt,
    isPinned: conversation.isPinned,
    pinnedAt: conversation.pinnedAt,
    pagePath: conversation.pagePath,
    pageTitle: conversation.pageTitle,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  }
}

function matchConversation(conversation: StoredConversation, query?: string) {
  if (!query?.trim()) return true
  const normalized = query.trim().toLowerCase()
  const haystack = [
    conversation.title,
    conversation.preview,
    conversation.pageTitle,
    ...conversation.messages.map((message) => message.content),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return haystack.includes(normalized)
}

function buildPromptId(seed: string, serviceSlug?: string | null) {
  return serviceSlug ? `${seed}-${serviceSlug}` : seed
}

function getPendingStepCopy(step: BookingStep, index: number) {
  return `${index + 1}. ${step.title}: ${step.description}.`
}

function createNavigateAction(
  id: string,
  label: string,
  href: string,
  description?: string,
): AssistantAction {
  return {
    id,
    type: "NAVIGATE",
    label,
    href,
    description,
  }
}

function createDraftAction(id: string, label: string, text: string): AssistantAction {
  return {
    id,
    type: "APPLY_DRAFT",
    label,
    payload: { text },
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}

function parseBudgetAmount(input: string) {
  const normalized = input.toLowerCase()

  if (/\b(a|one)\s+lakh\b/.test(normalized)) {
    return 100000
  }

  const lakhMatch = normalized.match(/(?:₹\s*)?(\d+(?:\.\d+)?)\s*lakh\b/)
  if (lakhMatch) {
    return Math.round(Number(lakhMatch[1]) * 100000)
  }

  const thousandMatch = normalized.match(/(?:₹\s*)?(\d+(?:\.\d+)?)\s*k\b/)
  if (thousandMatch) {
    return Math.round(Number(thousandMatch[1]) * 1000)
  }

  const rupeeMatch = normalized.match(/₹?\s*([\d,]{4,9})\b/)
  if (rupeeMatch) {
    const digits = Number(rupeeMatch[1].replace(/,/g, ""))
    if (!Number.isNaN(digits)) {
      return digits
    }
  }

  return null
}

function parseGuestCount(input: string) {
  const guestMatch = input.toLowerCase().match(/\b(\d{1,4})\s*(guest|guests|people|pax|persons)\b/)
  if (!guestMatch) return null
  return Number(guestMatch[1])
}

function parseLocation(input: string) {
  const locationMatch = input.match(/\b(?:in|at)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\b/)
  return locationMatch?.[1] ?? null
}

function parseIndoorOutdoor(input: string) {
  const normalized = input.toLowerCase()
  if (normalized.includes("indoor")) return "indoor"
  if (normalized.includes("outdoor")) return "outdoor"
  return null
}

function parseOccasion(input: string) {
  const normalized = input.toLowerCase()
  const occasions = [
    "ugadi",
    "diwali",
    "holi",
    "christmas",
    "birthday",
    "anniversary",
    "wedding",
    "reception",
    "engagement",
    "launch",
    "mixer",
    "festival",
    "office party",
    "corporate event",
  ]

  const found = occasions.find((occasion) => normalized.includes(occasion))
  return found
    ? found.replace(/\b\w/g, (character) => character.toUpperCase())
    : null
}

function inferEventType(input: string) {
  const normalized = input.toLowerCase()

  if (/\b(office|corporate|team|work|workplace|company)\b/.test(normalized)) {
    return "office event"
  }

  if (/\b(home|house|private)\b/.test(normalized)) {
    return "house event"
  }

  if (/\b(pool|poolside)\b/.test(normalized)) {
    return "pool event"
  }

  if (/\b(festival|public|concert|crowd)\b/.test(normalized)) {
    return "festival event"
  }

  return null
}

function inferVenueHint(input: string) {
  const normalized = input.toLowerCase()

  if (normalized.includes("office")) return "office"
  if (normalized.includes("home") || normalized.includes("house")) return "home"
  if (normalized.includes("pool")) return "pool"
  if (normalized.includes("hotel")) return "hotel"
  if (normalized.includes("outdoor")) return "outdoor venue"

  return null
}

function inferServiceFromBrief(
  input: string,
  fallbackServiceSlug?: string | null,
) {
  const resolvedFromText = resolveServiceFromText(input, null)
  if (resolvedFromText) {
    return resolvedFromText
  }

  const normalized = input.toLowerCase()

  if (/\b(office|corporate|team|work|company)\b/.test(normalized)) {
    return "corporate"
  }

  if (/\b(home|house|private)\b/.test(normalized)) {
    return "martini"
  }

  if (/\b(pool|poolside)\b/.test(normalized)) {
    return "negroni"
  }

  if (/\b(festival|public|concert|crowd)\b/.test(normalized)) {
    return "festival"
  }

  return fallbackServiceSlug ?? null
}

function getLikelyInclusions(serviceSlug?: string | null) {
  switch (serviceSlug) {
    case "corporate":
      return [
        "bartender service",
        "drinks setup",
        "menu planning",
        "custom drink options",
      ]
    case "martini":
      return [
        "bartender service",
        "home bar setup",
        "signature cocktails",
        "glassware support",
      ]
    case "negroni":
      return [
        "poolside drinks setup",
        "bartender service",
        "summer menu planning",
        "guest service support",
      ]
    case "festival":
      return [
        "bar stations",
        "fast service team",
        "menu planning",
        "operations support",
      ]
    default:
      return ["bartender service", "drinks setup", "menu planning"]
  }
}

function extractBookingMemory(
  content: string,
  context: AssistantConversationContext,
  history: PublicHistoryEntry[],
): BookingMemory {
  const transcript = [
    ...history.map((entry) => entry.content),
    content,
  ].join(" ")
  const serviceSlug = inferServiceFromBrief(transcript, getServiceSlug(context))
  const budgetAmount = parseBudgetAmount(transcript)
  const budgetText = budgetAmount ? formatCurrency(budgetAmount) : undefined
  const guestCount = parseGuestCount(transcript) ?? undefined
  const location = parseLocation(transcript) ?? undefined
  const indoorOutdoor = parseIndoorOutdoor(transcript) ?? undefined
  const occasion = parseOccasion(transcript) ?? undefined
  const eventType = inferEventType(transcript) ?? undefined
  const venueHint = inferVenueHint(transcript) ?? undefined
  const needsFood = /\b(food|snacks|catering|meal|buffet)\b/.test(transcript.toLowerCase())

  const missingDetails = [
    location ? null : "city/location",
    /\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)|tomorrow|next week|next month|\d{4}-\d{2}-\d{2})\b/i.test(
      transcript,
    )
      ? null
      : "date",
    indoorOutdoor ? null : "indoor or outdoor",
    needsFood ? null : "whether you need food service as well",
  ].filter(Boolean) as string[]

  return {
    occasion,
    eventType,
    serviceSlug,
    guestCount,
    budgetAmount: budgetAmount ?? undefined,
    budgetText,
    venueHint,
    location,
    indoorOutdoor,
    needsFood,
    likelyInclusions: getLikelyInclusions(serviceSlug),
    missingDetails,
  }
}

function classifyPublicIntent(
  content: string,
  context: AssistantConversationContext,
  history: PublicHistoryEntry[],
  memory: BookingMemory,
) {
  const normalized = content.toLowerCase()
  const intents = new Set<PublicIntent>()

  if (/^(hi|hello|hey|yo)\b/.test(normalized.trim())) {
    intents.add("greeting")
  }

  if (isPageAboutIntent(normalized) || /\b(what|how|why|when)\b/.test(normalized)) {
    intents.add("informational_question")
  }

  if (isBookingIntent(normalized) || isBookingFollowUp(history)) {
    intents.add("booking_inquiry")
  }

  if (
    memory.guestCount ||
    memory.budgetAmount ||
    memory.occasion ||
    memory.eventType ||
    memory.venueHint
  ) {
    intents.add("booking_inquiry")
  }

  if (
    /\b(recommend|best fit|which service|fit)\b/.test(normalized) ||
    (memory.serviceSlug &&
      (memory.guestCount ||
        memory.budgetAmount ||
        memory.occasion ||
        memory.eventType ||
        memory.venueHint))
  ) {
    intents.add("service_recommendation")
  }

  if (/\b(price|pricing|budget|cost|quote|lakh|₹)\b/.test(normalized) || memory.budgetAmount) {
    intents.add("budget_discussion")
  }

  if (/\b(open|take me|show me|go to|navigate)\b/.test(normalized)) {
    intents.add("navigation_request")
  }

  if (/\b(help|issue|problem|stuck)\b/.test(normalized)) {
    intents.add("support_issue")
  }

  if (isOfflineBookingIntent(normalized)) {
    intents.add("escalation_request")
  }

  if (
    /\b(snacks|food|catering|meal)\b/.test(normalized) &&
    (history.length > 0 || memory.serviceSlug || memory.guestCount || memory.budgetAmount)
  ) {
    intents.add("booking_inquiry")
  }

  if (!intents.size && getContextSection(context) === "booking") {
    intents.add("booking_inquiry")
  }

  return Array.from(intents)
}

function getBudgetFit(memory: BookingMemory) {
  if (!memory.budgetAmount || !memory.guestCount) {
    return null
  }

  const serviceSlug = memory.serviceSlug
  if (!serviceSlug) {
    return `${memory.budgetText} gives us enough room to shape a sensible package once the service lane is confirmed.`
  }

  const packageGroup = getPackageGroup(serviceSlug)
  if (!packageGroup) {
    return `${memory.budgetText} looks workable once the final scope is confirmed.`
  }

  const pricedPackages = packageGroup.packages
    .map((pkg) => ({
      ...pkg,
      minPrice: Number(pkg.price.replace(/[^\d]/g, "")) || 0,
    }))
    .filter((pkg) => pkg.minPrice > 0)

  const matchingPackage =
    pricedPackages.find((pkg) => {
      const guestCapMatch = pkg.guests.match(/(\d+)/)
      const guestCap = guestCapMatch ? Number(guestCapMatch[1]) : null
      return guestCap ? memory.guestCount! <= guestCap : false
    }) ?? pricedPackages[0]

  if (!matchingPackage) {
    return `${memory.budgetText} looks workable once the final scope is confirmed.`
  }

  if (memory.budgetAmount >= matchingPackage.minPrice * 1.5) {
    return `${memory.budgetText} is a comfortable range for ${memory.guestCount} guests.`
  }

  if (memory.budgetAmount >= matchingPackage.minPrice) {
    return `${memory.budgetText} looks reasonable for ${memory.guestCount} guests.`
  }

  return `${memory.budgetText} may be a little tight for ${memory.guestCount} guests unless we keep the setup lean.`
}

function createBookingRecommendationActions(
  memory: BookingMemory,
  context: AssistantConversationContext,
) {
  const serviceSlug = memory.serviceSlug ?? getServiceSlug(context)
  const serviceLabel = resolveBookingService(serviceSlug)?.shortLabel ?? "the right"
  const budgetPrompt = memory.budgetText ?? "my budget"
  const guestsPrompt = memory.guestCount ? `${memory.guestCount} guests` : "my guest count"

  return [
    createNavigateAction(
      `booking-start-${serviceSlug ?? "general"}`,
      serviceSlug ? `Start ${serviceLabel} booking` : "Start booking",
      buildBookingHref({ service: serviceSlug ?? undefined }),
      "Move straight into the booking flow.",
    ),
    createDraftAction(
      `estimate-${serviceSlug ?? "general"}`,
      "Estimate package",
      `Estimate the best ${serviceLabel.toLowerCase()} package for ${guestsPrompt} with a budget around ${budgetPrompt}.`,
    ),
    createDraftAction(
      `compare-${serviceSlug ?? "general"}`,
      "Compare services",
      "Compare the best service options for this event.",
    ),
    createDraftAction(
      `team-${serviceSlug ?? "general"}`,
      "Talk to team",
      "Draft a message to the team with my event brief and next questions.",
    ),
  ]
}

function buildBookingRecommendationReply(
  memory: BookingMemory,
  context: AssistantConversationContext,
  intents: PublicIntent[],
): PublicReply | null {
  const shouldHandle =
    intents.includes("booking_inquiry") ||
    intents.includes("service_recommendation") ||
    intents.includes("budget_discussion")

  if (!shouldHandle) {
    return null
  }

  if (!memory.serviceSlug && !memory.guestCount && !memory.budgetAmount && !memory.occasion) {
    return null
  }

  const resolvedService = resolveBookingService(memory.serviceSlug)
  const serviceLabel =
    resolvedService?.defaultEventType ?? resolvedService?.shortLabel ?? "Best fit is not locked yet"
  const budgetFit = getBudgetFit(memory)
  const occasionLine = [
    memory.occasion,
    memory.venueHint === "office" ? "office celebration" : memory.eventType,
  ]
    .filter(Boolean)
    .join(" ")
    .trim()

  const fitLine = memory.serviceSlug
    ? `Best fit: ${serviceLabel}.`
    : "Best fit: I need the service lane confirmed first."

  const contextLine =
    occasionLine || memory.guestCount || memory.budgetText
      ? `Based on ${[
          occasionLine || null,
          memory.guestCount ? `${memory.guestCount} guests` : null,
          memory.budgetText ? `a budget near ${memory.budgetText}` : null,
        ]
          .filter(Boolean)
          .join(", ")}, ${memory.serviceSlug ? "this looks like the cleanest fit." : "I can narrow the best fit quickly."}`
      : null

  const inclusionLine = `Likely inclusions: ${memory.likelyInclusions.join(", ")}.`
  const nextQuestions = memory.missingDetails.slice(0, 4)
  const foodLine = memory.needsFood
    ? "Food note: snacks or catering can be added, so I just need to know whether you want light snacks or a fuller food service."
    : null

  return {
    content: [
      fitLine,
      contextLine,
      budgetFit ? `Budget fit: ${budgetFit}` : null,
      inclusionLine,
      foodLine,
      nextQuestions.length ? `Need next: ${nextQuestions.join(", ")}.` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    actions: createBookingRecommendationActions(memory, context),
  }
}

function includesAny(input: string, phrases: string[]) {
  return phrases.some((phrase) => input.includes(phrase))
}

function getContextSection(context: AssistantConversationContext) {
  return typeof context.metadata?.section === "string"
    ? context.metadata.section
    : "general"
}

function getHistory(context: AssistantConversationContext) {
  const rawHistory = context.metadata?.history
  if (!Array.isArray(rawHistory)) {
    return [] as PublicHistoryEntry[]
  }

  return rawHistory
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null

      const actor =
        typeof entry.actor === "string" ? entry.actor.toUpperCase() : null
      const content = typeof entry.content === "string" ? entry.content.trim() : ""

      if (!actor || !content) return null
      if (actor !== "USER" && actor !== "ASSISTANT" && actor !== "SYSTEM") {
        return null
      }

      return {
        actor: actor as PublicHistoryEntry["actor"],
        content,
      }
    })
    .filter(Boolean) as PublicHistoryEntry[]
}

function getLastHistoryMessage(
  history: PublicHistoryEntry[],
  actor: PublicHistoryEntry["actor"],
) {
  return [...history].reverse().find((entry) => entry.actor === actor) ?? null
}

function resolveServiceFromText(
  content: string,
  fallbackServiceSlug?: string | null,
) {
  const normalized = content.toLowerCase()
  const match = bookingServices.find((service) =>
    [service.slug, ...service.aliases].some((alias) => normalized.includes(alias.toLowerCase())),
  )

  return match?.slug ?? fallbackServiceSlug ?? null
}

function isPageAboutIntent(input: string) {
  return includesAny(input, [
    "what is this page about",
    "what's this page about",
    "what is this page",
    "what does this page do",
    "explain this page",
  ])
}

function isBookingIntent(input: string) {
  return includesAny(input, [
    "book for me",
    "start booking",
    "book this",
    "i want to book",
    "help me book",
    "create booking",
    "take me to booking",
  ])
}

function isOfflineBookingIntent(input: string) {
  return includesAny(input, [
    "book offline",
    "offline booking",
    "book manually",
    "manual booking",
    "human help",
    "someone book for me",
  ])
}

function isAfterSubmitIntent(input: string) {
  return includesAny(input, [
    "what happens after i submit",
    "what happens after submission",
    "after i submit",
    "after submission",
    "what happens next after i submit",
  ])
}

function isNextStepIntent(input: string) {
  return includesAny(input, [
    "show me the next step",
    "what is the next step",
    "what should i do next",
    "what next",
    "next step",
  ])
}

function looksLikeBookingDetail(input: string) {
  return (
    /\b(guest|guests|people|venue|date|budget|party|event|corporate|festival|house|pool)\b/.test(
      input,
    ) || /\b\d{1,4}\b/.test(input)
  )
}

function isBookingFollowUp(history: PublicHistoryEntry[]) {
  const lastAssistantMessage = getLastHistoryMessage(history, "ASSISTANT")
  if (!lastAssistantMessage) return false

  const normalized = lastAssistantMessage.content.toLowerCase()
  return includesAny(normalized, [
    "what type of event are you planning",
    "share the event date",
    "venue, and guest count",
    "continue booking",
  ])
}

function buildPageAboutReply(context: AssistantConversationContext): PublicReply {
  const section = getContextSection(context)
  const serviceSlug = getServiceSlug(context)
  const resolvedService = resolveBookingService(serviceSlug)
  const marketingService = getMarketingService(serviceSlug)

  switch (section) {
    case "booking":
      return {
        content:
          "This page is for creating a booking request. You can choose the service type, enter event details, set preferences, and submit everything for review.",
        actions: [getRoleAwareLandingAction(context)],
      }
    case "service":
      return {
        content: `${marketingService?.title ?? resolvedService?.shortLabel ?? "This service"} page explains the experience, package fit, and when it works best before you move into booking.`,
        actions: [getRoleAwareLandingAction(context)],
      }
    case "team":
      return {
        content:
          "This page helps you explore the team and get a feel for the style before you move into the right service or booking flow.",
        actions: [createNavigateAction("team-booking", "Open booking", "/booking")],
      }
    case "payments":
      return {
        content:
          "This page is for reviewing payment steps and confirming any pending milestone before the event moves forward.",
        actions: [],
      }
    case "contracts":
      return {
        content:
          "This page is for reviewing the agreement terms, checking the status, and moving toward signing when everything looks right.",
        actions: [],
      }
    default:
      return {
        content:
          "This page is part of the TIB concierge flow. I can explain what it does, help you move to the right service, or start the booking path for you.",
        actions: [getRoleAwareLandingAction(context)],
      }
  }
}

function buildOfflineBookingReply(context: AssistantConversationContext): PublicReply {
  return {
    content:
      "You can either submit the booking yourself here, or our admin team can create the booking for you manually and send the proposal and login details through email.",
    actions: [getRoleAwareLandingAction(context)],
  }
}

function buildAfterSubmitReply(context: AssistantConversationContext): PublicReply {
  return {
    content:
      "After submission, the admin team reviews your request, creates a proposal, assigns the team if needed, and shares payment or contract steps depending on the event.",
    actions: [getRoleAwareLandingAction(context)],
  }
}

function buildNextStepReply(context: AssistantConversationContext): PublicReply {
  const section = getContextSection(context)
  const serviceSlug = getServiceSlug(context)
  const resolvedService = resolveBookingService(serviceSlug)

  if (section === "booking") {
    return {
      content: resolvedService
        ? `Next, add the event details for your ${resolvedService.shortLabel.toLowerCase()} request and submit it for review.`
        : "Next, choose your service type so the booking flow can shape the right brief.",
      actions: [getRoleAwareLandingAction(context)],
    }
  }

  if (section === "service") {
    return {
      content:
        "Next, decide if this service fits the event, then move into booking so we can collect the date, venue, and guest count.",
      actions: [getRoleAwareLandingAction(context)],
    }
  }

  if (section === "team") {
    return {
      content:
        "Next, pick the service lane that matches the event and move into booking when you're ready to share the brief.",
      actions: [createNavigateAction("team-booking-next", "Open booking", "/booking")],
    }
  }

  if (section === "payments") {
    return {
      content: "Next, complete the pending milestone payment so the booking can keep moving.",
      actions: [],
    }
  }

  if (section === "contracts") {
    return {
      content: "Next, review and sign the agreement so the booking can move into the confirmed stage.",
      actions: [],
    }
  }

  return {
    content:
      "Next, either choose the service that fits your event or jump straight into the booking flow and I will guide the brief from there.",
    actions: [getRoleAwareLandingAction(context)],
  }
}

function buildBookingConciergeReply(
  content: string,
  context: AssistantConversationContext,
  history: PublicHistoryEntry[],
): PublicReply | null {
  const normalized = content.toLowerCase()
  const currentServiceSlug = getServiceSlug(context)
  const matchedServiceSlug = resolveServiceFromText(content, currentServiceSlug)
  const resolvedService = resolveBookingService(matchedServiceSlug)

  if (isBookingIntent(normalized)) {
    if (resolvedService) {
      return {
        content: `Sure. I can help you start a ${resolvedService.shortLabel.toLowerCase()} booking. First, what date, venue, and guest count should I plan around?`,
        actions: [getRoleAwareLandingAction({ ...context, metadata: { ...context.metadata, serviceSlug: resolvedService.slug } })],
      }
    }

    return {
      content:
        "Sure. I can help you start a booking. First, what type of event are you planning?",
      actions: [getRoleAwareLandingAction(context)],
    }
  }

  if (!isBookingFollowUp(history)) {
    return null
  }

  if (resolvedService) {
    return {
      content: `Perfect. I'll line this up as a ${resolvedService.shortLabel.toLowerCase()} booking. Next, share the date, venue, and guest count, or open the form and I'll keep guiding you from there.`,
      actions: [getRoleAwareLandingAction({ ...context, metadata: { ...context.metadata, serviceSlug: resolvedService.slug } })],
    }
  }

  if (looksLikeBookingDetail(normalized)) {
    return {
      content:
        "Perfect. That gives me enough to move the booking forward. The next step is to place those details into the booking form so the team can review and respond cleanly.",
      actions: [getRoleAwareLandingAction(context)],
    }
  }

  return null
}

function createServiceSuggestions(context: AssistantConversationContext) {
  const serviceSlug = getServiceSlug(context)
  const resolvedService = resolveBookingService(serviceSlug)
  const marketingService = getMarketingService(serviceSlug)
  const bookingHref = buildBookingHref({
    service: resolvedService?.slug ?? serviceSlug ?? undefined,
  })

  return [
    {
      id: buildPromptId("service-summary", serviceSlug),
      title: "Summarize this service",
      prompt: `Summarize this ${marketingService?.title ?? resolvedService?.shortLabel ?? "service"} page`,
      description: "A quick read on what this experience is built for.",
    },
    {
      id: buildPromptId("service-package", serviceSlug),
      title: "Best package",
      prompt: "Which package should I start with here?",
      description: "A concise recommendation based on the current service.",
    },
    {
      id: buildPromptId("service-booking", serviceSlug),
      title: "Start booking",
      prompt: `Take me into the ${marketingService?.title ?? resolvedService?.shortLabel ?? "service"} booking flow`,
      description: bookingHref,
    },
  ] satisfies AssistantPromptSuggestion[]
}

function getPublicSuggestions(context: AssistantConversationContext) {
  const section =
    typeof context.metadata?.section === "string" ? context.metadata.section : "general"

  if (section === "service") {
    return createServiceSuggestions(context)
  }

  if (section === "booking") {
    return [
      {
        id: buildPromptId("booking-pending", getServiceSlug(context)),
        title: "What is pending?",
        prompt: "What is still pending in this booking flow?",
        description: "See the steps left before sending the request.",
      },
      {
        id: buildPromptId("booking-summary", getServiceSlug(context)),
        title: "Summarize booking",
        prompt: "Summarize this booking flow for me",
        description: "A quick overview of what the form needs.",
      },
      {
        id: buildPromptId("booking-help", getServiceSlug(context)),
        title: "What should I prepare?",
        prompt: "What details should I have ready before I submit?",
        description: "Keep the form fast and clean.",
      },
    ] satisfies AssistantPromptSuggestion[]
  }

  if (section === "team") {
    return [
      {
        id: "team-who",
        title: "Who should I book?",
        prompt: "How do I choose the right team profile for my event?",
        description: "A quick way to narrow the lineup.",
      },
      {
        id: "team-services",
        title: "Best service fit",
        prompt: "Which service fits my event best?",
        description: "Map your event style to the right page.",
      },
      {
        id: "team-booking",
        title: "Start planning",
        prompt: "Take me to the booking flow",
        description: "Move from browsing to action.",
      },
    ] satisfies AssistantPromptSuggestion[]
  }

  return DEFAULT_PUBLIC_SUGGESTIONS
}

function getRoleAwareLandingAction(context?: AssistantConversationContext) {
  const serviceSlug = getServiceSlug(context)
  if (serviceSlug) {
    return createNavigateAction(
      `navigate-booking-${serviceSlug}`,
      "Open booking",
      buildBookingHref({ service: serviceSlug }),
      "Start with this service preselected.",
    )
  }

  return createNavigateAction(
    "navigate-booking",
    "Open booking",
    "/booking",
    "Jump into the enquiry flow.",
  )
}

function buildServiceReply(
  content: string,
  context: AssistantConversationContext,
): PublicReply | null {
  const serviceSlug = getServiceSlug(context)
  const resolvedService = resolveBookingService(serviceSlug)
  const marketingService = getMarketingService(serviceSlug)
  const packageGroup = getPackageGroup(serviceSlug)

  if (!resolvedService || !marketingService || !packageGroup) {
    return null
  }

  const normalized = content.toLowerCase()
  const popularPackage =
    packageGroup.packages.find((item) => item.popular) ?? packageGroup.packages[0]
  const entryPackage = packageGroup.packages[0]
  const bookingAction = getRoleAwareLandingAction(context)
  const serviceAction = createNavigateAction(
    `navigate-service-${resolvedService.slug}`,
    "View service page",
    marketingService.id === "bloody-mary" ? "/bloody-mary" : `/${marketingService.id}`,
    "Stay on the current service lane.",
  )

  if (/(package|price|pricing|budget|cost|quote|best fit|best package)/.test(normalized)) {
    return {
      content: `${marketingService.title} starts from ${entryPackage.price}. The sharpest middle ground is usually ${popularPackage.name} for ${popularPackage.guests}, especially if you want a premium setup without overbuilding the scope.`,
      actions: [
        bookingAction,
        createDraftAction(
          `draft-package-${resolvedService.slug}`,
          "Draft brief",
          `Hi, I'm interested in the ${marketingService.title} setup and would like a quote around the ${popularPackage.name} package. Can you help me confirm availability and next steps?`,
        ),
      ],
    }
  }

  if (/(book|booking|start|next step|availability|enquire|inquiry|quote)/.test(normalized)) {
    return {
      content: `The quickest path is to share the date, venue, guest count, and rough budget. I can drop you into the booking flow with ${marketingService.title.toLowerCase()} already lined up so you are not starting cold.`,
      actions: [bookingAction, serviceAction],
    }
  }

  return {
    content: `${marketingService.title} is built for ${marketingService.description.toLowerCase()} The usual sweet spot is ${popularPackage.name}, and the concierge flow from here is simple: choose the scope, share event basics, then let the team shape the final setup with you.`,
    actions: [bookingAction, serviceAction],
  }
}

function buildBookingReply(
  content: string,
  context: AssistantConversationContext,
): PublicReply | null {
  const normalized = content.toLowerCase()
  const serviceSlug = getServiceSlug(context)
  const resolvedService = resolveBookingService(serviceSlug)
  const bookingAction = getRoleAwareLandingAction(context)

  if (/(pending|left|remaining|what is pending)/.test(normalized)) {
    return {
      content: `Still to cover before submission:\n${BOOKING_STEPS.map(getPendingStepCopy).join("\n")}\n\nIf you already know the date, guest count, and budget band, the rest usually moves very quickly.`,
      actions: [bookingAction],
    }
  }

  if (/(prepare|ready|what do i need|what details)/.test(normalized)) {
    return {
      content: `Have these ready and the flow stays smooth: event date, venue, guest count, budget range, and the service mood you want. ${resolvedService ? `${resolvedService.shortLabel} is already a good frame for the event type.` : "Once the event basics are clear, the team can guide the right package."}`,
      actions: [bookingAction],
    }
  }

  if (/(submit|after submit|after submission|what happens after)/.test(normalized)) {
    return buildAfterSubmitReply(context)
  }

  return {
    content: `${resolvedService ? `${resolvedService.shortLabel} booking` : "This booking flow"} is designed to gather the service type, event basics, preferences, and a final review before the team steps in.`,
    actions: [bookingAction],
  }
}

function buildTeamReply(): PublicReply {
  return {
    content: "Use the team page to get a feel for style and fit, then let the service page do the practical work. If you already know the event type, I'd move next to the matching service or straight into booking.",
    actions: [
      createNavigateAction("navigate-martini", "House parties", "/martini"),
      createNavigateAction("navigate-booking", "Open booking", "/booking"),
    ],
  }
}

function buildGeneralReply(content: string, context: AssistantConversationContext): PublicReply {
  const normalized = content.toLowerCase()
  const section = getContextSection(context)

  if (/(service|which service|fit my event|recommend)/.test(normalized)) {
    return {
      content: "The main lanes are house parties, pool parties, corporate events, and festivals. If you tell me the event style, guest count, and vibe, I can point you to the cleanest starting page.",
      actions: [
        createNavigateAction("navigate-house", "House parties", "/martini"),
        createNavigateAction("navigate-corporate", "Corporate events", "/cosmo"),
        getRoleAwareLandingAction(context),
      ],
    }
  }

  if (/(price|pricing|budget|cost)/.test(normalized)) {
    return {
      content: "Pricing depends mostly on guest count, service duration, and how premium the setup needs to feel. The public pages give solid starting bands, and the booking flow is the fastest way to turn that into a real quote.",
      actions: [
        createNavigateAction("navigate-negroni", "Pool parties", "/negroni"),
        getRoleAwareLandingAction(context),
      ],
    }
  }

  if (section === "booking") {
    return {
      content:
        "I can help you start the booking, explain what happens after submission, or tell you the next step from here.",
      actions: [getRoleAwareLandingAction(context)],
    }
  }

  if (section === "service") {
    return {
      content:
        "I can explain this service, help you judge the fit, or move you straight into booking with the right lane preselected.",
      actions: [getRoleAwareLandingAction(context)],
    }
  }

  return {
    content:
      "I can explain what this page is doing, point you to the right service, or move you straight into booking when you're ready.",
    actions: [getRoleAwareLandingAction(context)],
  }
}

function buildGuestReply(
  content: string,
  context: AssistantConversationContext,
): PublicReply {
  const section = getContextSection(context)
  const normalized = content.toLowerCase()
  const history = getHistory(context)
  const memory = extractBookingMemory(content, context, history)
  const intents = classifyPublicIntent(content, context, history, memory)

  if (isPageAboutIntent(normalized)) {
    return buildPageAboutReply(context)
  }

  if (isBookingIntent(normalized)) {
    const conciergeReply = buildBookingConciergeReply(content, context, history)
    if (conciergeReply) {
      return conciergeReply
    }
  }

  if (isOfflineBookingIntent(normalized)) {
    return buildOfflineBookingReply(context)
  }

  if (isAfterSubmitIntent(normalized)) {
    return buildAfterSubmitReply(context)
  }

  if (isNextStepIntent(normalized)) {
    return buildNextStepReply(context)
  }

  const bookingRecommendation = buildBookingRecommendationReply(memory, context, intents)
  if (bookingRecommendation) {
    return bookingRecommendation
  }

  const bookingConciergeReply = buildBookingConciergeReply(content, context, history)
  if (bookingConciergeReply) {
    return bookingConciergeReply
  }

  if (section === "service") {
    return buildServiceReply(content, context) ?? buildGeneralReply(content, context)
  }

  if (section === "booking") {
    return buildBookingReply(content, context) ?? buildGeneralReply(content, context)
  }

  if (section === "team") {
    return buildTeamReply()
  }

  return buildGeneralReply(content, context)
}

function buildConversationTitle(
  currentTitle: string,
  userContent: string,
  context?: AssistantConversationContext,
) {
  const normalizedCurrent = currentTitle.trim().toLowerCase()
  const defaultTitles = new Set([
    "",
    "new thread",
    "guest thread",
    context?.pageTitle?.trim().toLowerCase() ?? "",
  ])

  if (!defaultTitles.has(normalizedCurrent)) {
    return currentTitle
  }

  const trimmed = userContent.trim()
  if (!trimmed) {
    return context?.pageTitle?.trim() || "Guest thread"
  }

  return trimmed.length > 52 ? `${trimmed.slice(0, 49)}...` : trimmed
}

function ensureConversation(
  conversations: StoredConversation[],
  conversationId: string,
  context?: AssistantConversationContext,
) {
  const current = conversations.find((conversation) => conversation.id === conversationId)
  if (current) return current

  const now = getNowIso()
  const created: StoredConversation = {
    id: conversationId,
    title: context?.pageTitle?.trim() || "Guest thread",
    preview: null,
    messageCount: 0,
    isArchived: false,
    archivedAt: null,
    isPinned: false,
    pinnedAt: null,
    pagePath: context?.pagePath ?? null,
    pageTitle: context?.pageTitle ?? null,
    lastMessageAt: null,
    createdAt: now,
    updatedAt: now,
    context,
    messages: [],
  }

  conversations.unshift(created)
  return created
}

function persistConversationTurn(
  conversationId: string,
  payload: { content: string; context?: AssistantConversationContext },
) {
  const conversations = readStore()
  const conversation = ensureConversation(conversations, conversationId, payload.context)
  const now = getNowIso()
  const userMessage: AssistantMessage = {
    id: createId("guest-user"),
    actor: "USER",
    content: payload.content.trim(),
    actions: [],
    metadata: GUEST_MESSAGE_METADATA,
    createdAt: now,
  }

  const reply = buildGuestReply(payload.content, payload.context ?? conversation.context ?? {})
  const assistantMessage: AssistantMessage = {
    id: createId("guest-assistant"),
    actor: "ASSISTANT",
    content: reply.content,
    actions: reply.actions,
    metadata: GUEST_MESSAGE_METADATA,
    createdAt: getNowIso(),
  }

  const nextConversation: StoredConversation = {
    ...conversation,
    title: buildConversationTitle(conversation.title, payload.content, payload.context),
    preview: assistantMessage.content,
    messageCount: conversation.messages.length + 2,
    pagePath: payload.context?.pagePath ?? conversation.pagePath ?? null,
    pageTitle: payload.context?.pageTitle ?? conversation.pageTitle ?? null,
    lastMessageAt: assistantMessage.createdAt,
    updatedAt: assistantMessage.createdAt,
    context: payload.context ?? conversation.context,
    messages: [...conversation.messages, userMessage, assistantMessage],
  }

  const nextConversations = [
    nextConversation,
    ...conversations.filter((item) => item.id !== conversationId),
  ]
  writeStore(nextConversations)

  return {
    conversation: summarizeConversation(nextConversation),
    userMessage,
    assistantMessage,
  } satisfies AssistantTurnResponse
}

function buildLiveTurn(payload: {
  content: string
  context?: AssistantConversationContext
}) {
  const context = payload.context ?? {}
  const userMessage: AssistantMessage = {
    id: createId("guest-user"),
    actor: "USER",
    content: payload.content.trim(),
    actions: [],
    metadata: {
      ...GUEST_MESSAGE_METADATA,
      context,
    },
    createdAt: getNowIso(),
  }

  const reply = buildGuestReply(payload.content, context)
  const assistantMessage: AssistantMessage = {
    id: createId("guest-assistant"),
    actor: "ASSISTANT",
    content: reply.content,
    actions: reply.actions,
    metadata: {
      ...GUEST_MESSAGE_METADATA,
      actions: reply.actions,
      context,
    },
    createdAt: getNowIso(),
  }

  return {
    userMessage,
    assistantMessage,
  } satisfies AssistantLiveTurnResponse
}

function streamParts(content: string) {
  return content.match(/\S+\s*/g) ?? [content]
}

function wait(durationMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs)
  })
}

export const publicAssistantClient = {
  listConversations(options?: { search?: string; archived?: boolean } | string) {
    const resolvedOptions =
      typeof options === "string" ? { search: options } : options

    return Promise.resolve(
      readStore()
        .filter((conversation) => conversation.isArchived === Boolean(resolvedOptions?.archived))
        .filter((conversation) => matchConversation(conversation, resolvedOptions?.search))
        .map(summarizeConversation),
    )
  },
  createConversation(payload?: {
    title?: string
    context?: AssistantConversationContext
  }) {
    const conversations = readStore()
    const now = getNowIso()
    const conversation: StoredConversation = {
      id: createId("guest-conversation"),
      title: payload?.title?.trim() || payload?.context?.pageTitle?.trim() || "Guest thread",
      preview: null,
      messageCount: 0,
      isArchived: false,
      archivedAt: null,
      isPinned: false,
      pinnedAt: null,
      pagePath: payload?.context?.pagePath ?? null,
      pageTitle: payload?.context?.pageTitle ?? null,
      lastMessageAt: null,
      createdAt: now,
      updatedAt: now,
      context: payload?.context,
      messages: [],
    }

    writeStore([conversation, ...conversations.filter((item) => item.id !== conversation.id)])
    return Promise.resolve(summarizeConversation(conversation))
  },
  getMessages(conversationId: string) {
    const conversation = readStore().find((item) => item.id === conversationId)
    return Promise.resolve(conversation?.messages ?? [])
  },
  renameConversation(conversationId: string, title: string) {
    const conversations = readStore()
    const nextConversations = conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            title: title.trim() || conversation.title,
            updatedAt: getNowIso(),
          }
        : conversation,
    )

    writeStore(nextConversations)
    const updatedConversation = nextConversations.find((item) => item.id === conversationId)
    return Promise.resolve(
      updatedConversation
        ? summarizeConversation(updatedConversation)
        : {
            id: conversationId,
            title,
            preview: null,
            messageCount: 0,
            isArchived: false,
            archivedAt: null,
            isPinned: false,
            pinnedAt: null,
            createdAt: getNowIso(),
            updatedAt: getNowIso(),
          },
    )
  },
  archiveConversation(conversationId: string, isArchived: boolean) {
    const conversations = readStore()
    const now = getNowIso()
    const nextConversations = conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            isArchived,
            archivedAt: isArchived ? now : null,
            isPinned: isArchived ? false : conversation.isPinned,
            pinnedAt: isArchived ? null : conversation.pinnedAt,
            updatedAt: now,
          }
        : conversation,
    )

    writeStore(nextConversations)
    const updatedConversation = nextConversations.find((item) => item.id === conversationId)
    return Promise.resolve(
      updatedConversation
        ? summarizeConversation(updatedConversation)
        : {
            id: conversationId,
            title: "Guest thread",
            preview: null,
            messageCount: 0,
            isArchived,
            archivedAt: isArchived ? now : null,
            isPinned: false,
            pinnedAt: null,
            createdAt: now,
            updatedAt: now,
          },
    )
  },
  pinConversation(conversationId: string, isPinned: boolean) {
    const conversations = readStore()
    const now = getNowIso()
    const nextConversations = conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            isPinned,
            pinnedAt: isPinned ? now : null,
            updatedAt: now,
          }
        : conversation,
    )

    writeStore(nextConversations)
    const updatedConversation = nextConversations.find((item) => item.id === conversationId)
    return Promise.resolve(
      updatedConversation
        ? summarizeConversation(updatedConversation)
        : {
            id: conversationId,
            title: "Guest thread",
            preview: null,
            messageCount: 0,
            isArchived: false,
            archivedAt: null,
            isPinned,
            pinnedAt: isPinned ? now : null,
            createdAt: now,
            updatedAt: now,
          },
    )
  },
  deleteConversation(conversationId: string) {
    writeStore(readStore().filter((conversation) => conversation.id !== conversationId))
    return Promise.resolve({ success: true })
  },
  trackEvent(payload?: AssistantAnalyticsEvent) {
    void payload
    return Promise.resolve({ success: true })
  },
  getSuggestions(context: AssistantConversationContext) {
    return Promise.resolve(getPublicSuggestions(context))
  },
  sendMessage(
    conversationId: string,
    payload: { content: string; context?: AssistantConversationContext },
  ) {
    return Promise.resolve(persistConversationTurn(conversationId, payload))
  },
  async streamMessage(
    conversationId: string,
    payload: { content: string; context?: AssistantConversationContext },
    handlers?: GuestSseHandlers,
  ) {
    const turn = persistConversationTurn(conversationId, payload)

    handlers?.onTurn?.({
      conversation: turn.conversation,
      userMessage: turn.userMessage,
    })

    for (const part of streamParts(turn.assistantMessage.content)) {
      handlers?.onChunk?.(part)
      await wait(18)
    }

    handlers?.onComplete?.(turn)
  },
  sendLiveMessage(payload: {
    content: string
    context?: AssistantConversationContext
  }) {
    return Promise.resolve(buildLiveTurn(payload))
  },
  async streamLiveMessage(
    payload: { content: string; context?: AssistantConversationContext },
    handlers?: GuestLiveSseHandlers,
  ) {
    const turn = buildLiveTurn(payload)

    handlers?.onTurn?.({
      userMessage: turn.userMessage,
    })

    for (const part of streamParts(turn.assistantMessage.content)) {
      handlers?.onChunk?.(part)
      await wait(18)
    }

    handlers?.onComplete?.(turn)
  },
}
