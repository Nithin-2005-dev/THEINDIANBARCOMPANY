import type { CreateLeadPayload, PreferredContact } from "@/types/leads"
import { normalizePhone } from "@/lib/booking-validation"
import { resolveBookingService } from "./booking-service-config"

export type BookingStepId = "contact" | "event" | "preferences" | "review"

export type BookingStep = {
  id: BookingStepId
  title: string
  description: string
}

export const BOOKING_STEPS: BookingStep[] = [
  {
    id: "contact",
    title: "Contact",
    description: "How we reach you",
  },
  {
    id: "event",
    title: "Event",
    description: "Date, venue, guests",
  },
  {
    id: "preferences",
    title: "Preferences",
    description: "Budget and style",
  },
  {
    id: "review",
    title: "Review",
    description: "Final handoff",
  },
]

export type BookingFlowValues = {
  name: string
  phone: string
  email: string
  preferredContact: PreferredContact
  eventType: string
  location: string
  eventDate: string
  guestCount: string
  budgetMin: string
  budgetMax: string
  packageName: string
  packageLabel: string
  packageGuests: string
  packagePrice: string
  notes: string
  website: string
}

export type BookingFlowErrors = Partial<Record<keyof BookingFlowValues, string>>

export type BookingPrefillInput = {
  service?: string | null
  packageName?: string | null
  packageLabel?: string | null
  packageGuests?: string | null
  packagePrice?: string | null
}

export const BOOKING_STORAGE_KEY = "tib-booking-draft"

export const EMPTY_BOOKING_VALUES: BookingFlowValues = {
  name: "",
  phone: "",
  email: "",
  preferredContact: "whatsapp",
  eventType: "",
  location: "",
  eventDate: "",
  guestCount: "",
  budgetMin: "",
  budgetMax: "",
  packageName: "",
  packageLabel: "",
  packageGuests: "",
  packagePrice: "",
  notes: "",
  website: "",
}

export function parseBudgetNumber(value?: string | null) {
  if (!value) return ""

  const matches = value.replace(/,/g, "").match(/\d+/g)
  if (!matches || matches.length === 0) return ""
  return matches[0] ?? ""
}

export function parseGuestCount(value?: string | null) {
  if (!value) return ""

  const match = value.match(/\d+/)
  return match ? match[0] : ""
}

export function createBookingDraft(prefill: BookingPrefillInput = {}) {
  const resolvedService = resolveBookingService(prefill.service)
  const packageSummary = [prefill.packageName, prefill.packageGuests, prefill.packagePrice]
    .filter(Boolean)
    .join(" | ")

  return {
    ...EMPTY_BOOKING_VALUES,
    eventType: resolvedService?.defaultEventType ?? "",
    guestCount: parseGuestCount(prefill.packageGuests),
    budgetMin: parseBudgetNumber(prefill.packagePrice),
    packageName: prefill.packageName?.trim() ?? "",
    packageLabel: prefill.packageLabel?.trim() ?? resolvedService?.shortLabel ?? "",
    packageGuests: prefill.packageGuests?.trim() ?? "",
    packagePrice: prefill.packagePrice?.trim() ?? "",
    notes: packageSummary ? `Starting point: ${packageSummary}` : "",
  }
}

export function mergeBookingDraft(
  base: BookingFlowValues,
  override?: Partial<BookingFlowValues> | null,
) {
  if (!override) return base
  return { ...base, ...override }
}

export function formatPhoneInput(value: string) {
  const normalized = value.replace(/[^\d+]/g, "")
  if (!normalized) return ""

  const hasPlus = normalized.startsWith("+")
  const digitsOnly = normalized.replace(/[^\d]/g, "").slice(0, 12)

  if (hasPlus) {
    const country = digitsOnly.slice(0, 2)
    const partOne = digitsOnly.slice(2, 7)
    const partTwo = digitsOnly.slice(7, 12)
    return ["+" + country, partOne, partTwo].filter(Boolean).join(" ").trim()
  }

  if (digitsOnly.length <= 5) return digitsOnly
  if (digitsOnly.length <= 10) {
    return `${digitsOnly.slice(0, 5)} ${digitsOnly.slice(5)}`
  }

  return `${digitsOnly.slice(0, 2)} ${digitsOnly.slice(2, 7)} ${digitsOnly.slice(7)}`
}

export function formatMoneyInput(value: string) {
  const digitsOnly = value.replace(/[^\d]/g, "")
  if (!digitsOnly) return ""

  return Number(digitsOnly).toLocaleString("en-IN")
}

export function toLeadPayload(values: BookingFlowValues): CreateLeadPayload {
  const packageLabel =
    values.packageLabel.trim() || values.packageGuests.trim() || undefined

  return {
    name: values.name.trim(),
    phone: normalizePhone(values.phone),
    email: values.email.trim() || undefined,
    preferredContact: values.preferredContact,
    eventType: values.eventType.trim(),
    location: values.location.trim(),
    packageName: values.packageName.trim() || undefined,
    packageLabel,
    eventDate: new Date(values.eventDate).toISOString(),
    guestCount: Number(values.guestCount),
    budgetMin: Number(values.budgetMin.replace(/[^\d]/g, "")),
    budgetMax: Number(values.budgetMax.replace(/[^\d]/g, "")),
    notes: values.notes.trim() || undefined,
  }
}

export function formatDisplayDate(value?: string) {
  if (!value) return "To be confirmed"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "To be confirmed"

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function formatCurrencyRange(min?: string, max?: string) {
  const normalizedMin = min?.replace(/[^\d]/g, "")
  const normalizedMax = max?.replace(/[^\d]/g, "")

  if (!normalizedMin && !normalizedMax) return "Not shared yet"
  if (normalizedMin && normalizedMax) {
    return `INR ${formatMoneyInput(normalizedMin)} - INR ${formatMoneyInput(normalizedMax)}`
  }
  if (normalizedMin) return `From INR ${formatMoneyInput(normalizedMin)}`
  return `Up to INR ${formatMoneyInput(normalizedMax ?? "")}`
}
