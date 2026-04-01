import type { BookingSelection } from "@/types/leads"

export type BookingServiceSlug =
  | "martini"
  | "negroni"
  | "festival"
  | "corporate"

export type BookingServiceConfig = {
  slug: BookingServiceSlug
  aliases: string[]
  label: string
  shortLabel: string
  defaultEventType: string
  marketingPath?: string
  responseTime: string
  description: string
  benefits: string[]
  trustSignals: string[]
}

const BOOKING_SERVICES: BookingServiceConfig[] = [
  {
    slug: "martini",
    aliases: ["martini", "house-party", "houseparty", "house party"],
    label: "House party service",
    shortLabel: "House party",
    defaultEventType: "House Party",
    marketingPath: "/martini",
    responseTime: "Replies within 30 minutes during business hours",
    description:
      "Tell us about your celebration and our concierge team will confirm availability, shape the bar setup, and recommend the right package for your home event.",
    benefits: [
      "Tailored staffing and cocktail planning",
      "Clear guidance on guest count and bar scope",
      "Fast follow-up on call, WhatsApp, or email",
    ],
    trustSignals: ["No obligation", "Secure submission", "Private planning support"],
  },
  {
    slug: "corporate",
    aliases: ["corporate", "cosmo", "corporate-event", "corporate-events", "corporate event"],
    label: "Corporate event service",
    shortLabel: "Corporate",
    defaultEventType: "Corporate Event",
    marketingPath: "/cosmo",
    responseTime: "Replies within 30 minutes during business hours",
    description:
      "Brief us on the audience, venue, and event goals. We will confirm availability and shape a polished service plan for your team or clients.",
    benefits: [
      "Branded beverage planning for launches and mixers",
      "Reliable staffing and premium presentation",
      "Fast alignment for venues, timings, and guest flow",
    ],
    trustSignals: ["No obligation", "Secure submission", "Professional event planning"],
  },
  {
    slug: "negroni",
    aliases: ["negroni", "pool-party", "poolparty", "pool party"],
    label: "Pool party service",
    shortLabel: "Pool party",
    defaultEventType: "Pool Party",
    marketingPath: "/negroni",
    responseTime: "Replies within 30 minutes during business hours",
    description:
      "Share the date, venue, and guest count. We will confirm availability and build the right summer-ready bar plan for your poolside event.",
    benefits: [
      "Resort-style planning for poolside service",
      "Clear recommendations for setup, timing, and staffing",
      "Fast follow-up from the concierge team",
    ],
    trustSignals: ["No obligation", "Secure submission", "Private planning support"],
  },
  {
    slug: "festival",
    aliases: ["festival", "bloody-mary", "bloodymary", "bm", "festival event"],
    label: "Festival event service",
    shortLabel: "Festival",
    defaultEventType: "Festival Event",
    marketingPath: "/bloody-mary",
    responseTime: "Replies within 30 minutes during business hours",
    description:
      "For larger or higher-energy events, our team will review the operational scope, staffing needs, and bar footprint before confirming the next steps.",
    benefits: [
      "Designed for larger guest volumes and multiple bars",
      "Clear operational planning from the first conversation",
      "Fast follow-up for timelines, capacity, and production",
    ],
    trustSignals: ["No obligation", "Secure submission", "Operations-aware planning"],
  },
]

export const bookingServices = BOOKING_SERVICES

export function resolveBookingService(value?: string | null) {
  if (!value) return null

  const normalizedValue = value.trim().toLowerCase()
  return (
    BOOKING_SERVICES.find(
      (service) =>
        service.slug === normalizedValue || service.aliases.includes(normalizedValue),
    ) ?? null
  )
}

export function buildBookingHref(input?: {
  service?: string | null
  selection?: BookingSelection | null
}) {
  const query = new URLSearchParams()

  if (input?.service) {
    query.set("service", input.service)
  }

  if (input?.selection?.packageName) {
    query.set("packageName", input.selection.packageName)
  }

  if (input?.selection?.packageLabel) {
    query.set("packageLabel", input.selection.packageLabel)
  }

  if (input?.selection?.packageGuests) {
    query.set("packageGuests", input.selection.packageGuests)
  }

  if (input?.selection?.packagePrice) {
    query.set("packagePrice", input.selection.packagePrice)
  }

  for (const addOn of input?.selection?.addOns ?? []) {
    query.append("addOn", addOn)
  }

  const search = query.toString()
  return search ? `/booking?${search}` : "/booking"
}
