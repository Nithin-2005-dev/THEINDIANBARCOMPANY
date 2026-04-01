import type {
  BookingServiceConfig,
  BookingServiceSlug,
} from "@/components/booking/booking-service-config"

export type BookingExperienceMetric = {
  label: string
  value: string
}

export type BookingExperienceTestimonial = {
  quote: string
  name: string
  context: string
}

export type BookingPackageRecommendation = {
  badge?: string
  fit: string
  fromPrice: string
  guestLabel: string
  maxGuests: number | null
  name: string
}

export type BookingExperience = {
  heroDescription: string
  heroTitle: string
  metrics: BookingExperienceMetric[]
  moodCopy: string
  moodLabel: string
  testimonial: BookingExperienceTestimonial
  trustLine: string
}

export type BookingExperienceVisual = {
  heroImageSrc: string
  localeLabel: string
  serviceLabel: string
}

const SERVICE_RECOMMENDATIONS: Record<BookingServiceSlug, BookingPackageRecommendation[]> = {
  martini: [
    {
      name: "Classic",
      guestLabel: "Up to 20 guests",
      maxGuests: 20,
      fromPrice: "From INR 15,000",
      fit: "Clean, intimate service for smaller house parties.",
    },
    {
      badge: "Popular choice",
      name: "Signature",
      guestLabel: "Up to 40 guests",
      maxGuests: 40,
      fromPrice: "From INR 35,000",
      fit: "Best fit for lively home celebrations with a premium bar setup.",
    },
    {
      name: "Elite",
      guestLabel: "Up to 80 guests",
      maxGuests: 80,
      fromPrice: "From INR 75,000",
      fit: "Designed for larger private events that need a luxury service footprint.",
    },
  ],
  corporate: [
    {
      name: "Executive",
      guestLabel: "Up to 30 guests",
      maxGuests: 30,
      fromPrice: "From INR 25,000",
      fit: "Polished service for intimate launches, mixers, and executive events.",
    },
    {
      badge: "Popular choice",
      name: "Premium",
      guestLabel: "Up to 75 guests",
      maxGuests: 75,
      fromPrice: "From INR 55,000",
      fit: "A strong starting point for premium brand and team experiences.",
    },
    {
      name: "Black Tie Elite",
      guestLabel: "Up to 150 guests",
      maxGuests: 150,
      fromPrice: "From INR 1,20,000",
      fit: "Built for elevated corporate hospitality with VIP expectations.",
    },
  ],
  negroni: [
    {
      name: "Splash",
      guestLabel: "Up to 25 guests",
      maxGuests: 25,
      fromPrice: "From INR 18,000",
      fit: "A relaxed poolside bar format for smaller summer gatherings.",
    },
    {
      badge: "Popular choice",
      name: "Sunset",
      guestLabel: "Up to 50 guests",
      maxGuests: 50,
      fromPrice: "From INR 40,000",
      fit: "The right balance for stylish pool parties with premium ambience.",
    },
    {
      name: "Resort Elite",
      guestLabel: "Up to 100 guests",
      maxGuests: 100,
      fromPrice: "From INR 90,000",
      fit: "For high-energy pool events that need a more luxurious setup.",
    },
  ],
  festival: [
    {
      name: "Pulse",
      guestLabel: "Up to 100 guests",
      maxGuests: 100,
      fromPrice: "From INR 60,000",
      fit: "Efficient festival-ready service for high-energy crowd flow.",
    },
    {
      badge: "Popular choice",
      name: "Ignite",
      guestLabel: "Up to 300 guests",
      maxGuests: 300,
      fromPrice: "From INR 1,50,000",
      fit: "A strong operating baseline for larger events with multiple touchpoints.",
    },
    {
      name: "Mega Festival",
      guestLabel: "500+ guests",
      maxGuests: null,
      fromPrice: "Custom pricing",
      fit: "For large-format production where bar operations need scale and control.",
    },
  ],
}

const SERVICE_EXPERIENCES: Record<BookingServiceSlug, BookingExperience> = {
  martini: {
    heroTitle: "Craft an unforgettable house party experience.",
    heroDescription:
      "Tell us what you are planning and we will shape the bar, staffing, and service flow around your home event. No obligation, and our concierge team usually responds within 30 minutes during business hours.",
    trustLine: "Trusted by private hosts across India for premium home celebrations.",
    moodLabel: "Private celebration",
    moodCopy:
      "A tailored home-bar experience with polished staffing, premium cocktails, and zero guesswork.",
    testimonial: {
      quote: "Felt like a five-star lounge inside our home. Guests were blown away.",
      name: "Ananya Kapoor",
      context: "House party host",
    },
    metrics: [
      { label: "Typical response", value: "30 min" },
      { label: "Best-fit scale", value: "Up to 80 guests" },
      { label: "Starting points", value: "3 tailored tiers" },
      { label: "Planning style", value: "Private concierge" },
    ],
  },
  corporate: {
    heroTitle: "Luxury bartending, tailored to your event.",
    heroDescription:
      "Share the audience, venue, and commercial goals, and we will build a polished service recommendation around them. Expect a quick response, clear scope, and a premium handoff from inquiry to proposal.",
    trustLine: "Trusted by corporate hosts, premium venues, and brand teams across India.",
    moodLabel: "Executive hospitality",
    moodCopy:
      "Sharper service planning for launches, mixers, and polished client-facing events.",
    testimonial: {
      quote: "Professional team, world-class cocktails, and flawless execution.",
      name: "Vikram Shah",
      context: "Corporate event host",
    },
    metrics: [
      { label: "Typical response", value: "30 min" },
      { label: "Best-fit scale", value: "Up to 150 guests" },
      { label: "Starting points", value: "3 curated tiers" },
      { label: "Planning style", value: "Venue-ready" },
    ],
  },
  negroni: {
    heroTitle: "Premium cocktails. Seamless service. Memorable nights.",
    heroDescription:
      "From poolside sundowners to all-out summer celebrations, we will map the staffing, setup, and bar direction for you. Share the essentials and we will turn it into a clean, premium plan.",
    trustLine: "Trusted by hosts who want elevated poolside service without the planning friction.",
    moodLabel: "Poolside luxury",
    moodCopy:
      "Resort-style energy with premium cocktails, smooth flow, and summer-ready service.",
    testimonial: {
      quote: "One of the most premium event experiences we've ever had. Everything was seamless.",
      name: "Rohan Mehta",
      context: "Private celebration host",
    },
    metrics: [
      { label: "Typical response", value: "30 min" },
      { label: "Best-fit scale", value: "Up to 100 guests" },
      { label: "Starting points", value: "3 curated tiers" },
      { label: "Planning style", value: "Resort-inspired" },
    ],
  },
  festival: {
    heroTitle: "Tell us what you are planning. We will handle the rest.",
    heroDescription:
      "For larger and faster-moving events, our team reviews logistics, bar footprint, and guest flow early so the next step feels effortless. Share the outline and we will take it from there.",
    trustLine: "Trusted for high-energy events that need premium service with operational control.",
    moodLabel: "Large-format production",
    moodCopy:
      "Operationally aware planning for crowd-ready service, multiple bars, and larger timelines.",
    testimonial: {
      quote: "Exceptional service from start to finish. Truly unforgettable.",
      name: "Neha Sharma",
      context: "Festival host",
    },
    metrics: [
      { label: "Typical response", value: "30 min" },
      { label: "Best-fit scale", value: "500+ guests" },
      { label: "Starting points", value: "3 scalable tiers" },
      { label: "Planning style", value: "Operations-led" },
    ],
  },
}

const DEFAULT_EXPERIENCE: BookingExperience = {
  heroTitle: "Tell us what you are planning. We will handle the rest.",
  heroDescription:
    "Share the event essentials and our concierge team will recommend the right service path, quote direction, and next step. The flow is private, quick, and designed to feel effortless.",
  trustLine: "Trusted by private hosts, premium venues, and event teams across India.",
  moodLabel: "Tailored event planning",
  moodCopy: "A concierge-led route to the right service plan, without the usual booking friction.",
  testimonial: {
    quote: "One of the most premium event experiences we've ever had. Everything was seamless.",
    name: "Rohan Mehta",
    context: "Private celebration host",
  },
  metrics: [
    { label: "Typical response", value: "30 min" },
    { label: "Booking flow", value: "4 quick steps" },
    { label: "Coverage", value: "Across India" },
    { label: "Planning style", value: "Concierge-led" },
  ],
}

const SERVICE_VISUALS: Record<BookingServiceSlug, BookingExperienceVisual> = {
  martini: {
    heroImageSrc: "/images/martini/2.jpg",
    localeLabel: "PRIVATE HOSTS · INDIA",
    serviceLabel: "House party service",
  },
  corporate: {
    heroImageSrc: "/images/cosmo/2.jpg",
    localeLabel: "EXECUTIVE EVENTS · INDIA",
    serviceLabel: "Corporate hospitality",
  },
  negroni: {
    heroImageSrc: "/images/negroni/2.jpg",
    localeLabel: "POOLSIDE SERVICE · INDIA",
    serviceLabel: "Pool party service",
  },
  festival: {
    heroImageSrc: "/images/bm/2.jpg",
    localeLabel: "FESTIVAL PRODUCTION · INDIA",
    serviceLabel: "Festival concierge",
  },
}

const DEFAULT_VISUAL: BookingExperienceVisual = {
  heroImageSrc: "/images/martini/2.jpg",
  localeLabel: "LUXURY EVENTS · INDIA",
  serviceLabel: "Luxury concierge booking",
}

export function getBookingExperience(service?: BookingServiceConfig | null) {
  if (!service) return DEFAULT_EXPERIENCE
  return SERVICE_EXPERIENCES[service.slug]
}

export function getBookingVisual(service?: BookingServiceConfig | null) {
  if (!service) return DEFAULT_VISUAL
  return SERVICE_VISUALS[service.slug]
}

export function getBookingRecommendations(service?: BookingServiceConfig | null) {
  if (!service) return []
  return SERVICE_RECOMMENDATIONS[service.slug]
}

export function getRecommendedPackage(
  service?: BookingServiceConfig | null,
  guestCountValue?: number | string | null,
) {
  const recommendations = getBookingRecommendations(service)
  if (!recommendations.length) return null

  const preferredRecommendation =
    recommendations.find((recommendation) => recommendation.badge === "Popular choice") ??
    recommendations[0]

  const parsedGuestCount =
    typeof guestCountValue === "number"
      ? guestCountValue
      : Number(String(guestCountValue ?? "").replace(/[^\d]/g, ""))

  if (!parsedGuestCount || Number.isNaN(parsedGuestCount)) {
    return preferredRecommendation
  }

  return (
    recommendations.find(
      (recommendation) =>
        recommendation.maxGuests === null || parsedGuestCount <= recommendation.maxGuests,
    ) ?? recommendations[recommendations.length - 1]
  )
}
