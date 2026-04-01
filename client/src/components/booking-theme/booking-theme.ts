import type { CSSProperties } from "react"
import { resolveBookingService } from "@/components/booking/booking-service-config"

export type BookingThemeKey = "neutral" | "martini" | "corporate" | "negroni" | "festival"

type BookingThemeDefinition = {
  accent: string
  accentContrast: string
  accentRgb: string
  accentGlow: string
  panel: string
  panelStrong: string
  surface: string
  surfaceElevated: string
  metallic: string
}

type BookingThemeStyle = CSSProperties & Record<`--${string}`, string>

export type BookingThemeInput = {
  category?: string | null
  eventType?: string | null
  packageLabel?: string | null
  packageName?: string | null
  service?: string | null
  serviceId?: string | null
  serviceType?: string | null
}

const BOOKING_THEME_DEFINITIONS: Record<BookingThemeKey, BookingThemeDefinition> = {
  neutral: {
    accent: "#c7b79b",
    accentContrast: "#120f0a",
    accentRgb: "199, 183, 155",
    accentGlow: "rgba(199, 183, 155, 0.14)",
    panel: "rgba(16, 14, 12, 0.92)",
    panelStrong: "rgba(12, 10, 9, 0.97)",
    surface: "linear-gradient(180deg, rgba(255, 251, 244, 0.05), rgba(255, 251, 244, 0.02))",
    surfaceElevated: "linear-gradient(180deg, rgba(255, 251, 244, 0.08), rgba(255, 251, 244, 0.03))",
    metallic: "#f0e2c5",
  },
  martini: {
    accent: "#cfa764",
    accentContrast: "#1b1204",
    accentRgb: "207, 167, 100",
    accentGlow: "rgba(207, 167, 100, 0.14)",
    panel: "rgba(22, 14, 7, 0.93)",
    panelStrong: "rgba(17, 10, 5, 0.98)",
    surface: "linear-gradient(180deg, rgba(207, 167, 100, 0.09), rgba(255, 226, 166, 0.02))",
    surfaceElevated: "linear-gradient(180deg, rgba(240, 214, 164, 0.12), rgba(207, 167, 100, 0.04))",
    metallic: "#f4dfb5",
  },
  corporate: {
    accent: "#d6d9df",
    accentContrast: "#15171b",
    accentRgb: "214, 217, 223",
    accentGlow: "rgba(214, 217, 223, 0.12)",
    panel: "rgba(14, 16, 19, 0.93)",
    panelStrong: "rgba(11, 13, 16, 0.98)",
    surface: "linear-gradient(180deg, rgba(214, 217, 223, 0.08), rgba(214, 217, 223, 0.02))",
    surfaceElevated: "linear-gradient(180deg, rgba(247, 248, 251, 0.14), rgba(214, 217, 223, 0.04))",
    metallic: "#f3f6fb",
  },
  negroni: {
    accent: "#7faab8",
    accentContrast: "#0c1419",
    accentRgb: "127, 170, 184",
    accentGlow: "rgba(127, 170, 184, 0.14)",
    panel: "rgba(8, 16, 24, 0.94)",
    panelStrong: "rgba(6, 12, 18, 0.98)",
    surface: "linear-gradient(180deg, rgba(127, 170, 184, 0.09), rgba(188, 218, 230, 0.02))",
    surfaceElevated: "linear-gradient(180deg, rgba(171, 204, 216, 0.12), rgba(127, 170, 184, 0.04))",
    metallic: "#d7e6ea",
  },
  festival: {
    accent: "#c7a168",
    accentContrast: "#16110c",
    accentRgb: "199, 161, 104",
    accentGlow: "rgba(199, 161, 104, 0.14)",
    panel: "rgba(20, 13, 27, 0.94)",
    panelStrong: "rgba(15, 10, 20, 0.98)",
    surface: "linear-gradient(180deg, rgba(129, 94, 156, 0.09), rgba(199, 161, 104, 0.02))",
    surfaceElevated: "linear-gradient(180deg, rgba(150, 118, 174, 0.12), rgba(199, 161, 104, 0.04))",
    metallic: "#f0d9af",
  },
}

function createBookingThemeStyle(theme: BookingThemeDefinition): BookingThemeStyle {
  return {
    "--booking-accent": theme.accent,
    "--booking-accent-rgb": theme.accentRgb,
    "--booking-accent-soft": `rgba(${theme.accentRgb}, 0.08)`,
    "--booking-highlight": `rgba(${theme.accentRgb}, 0.12)`,
    "--booking-highlight-strong": `rgba(${theme.accentRgb}, 0.18)`,
    "--booking-focus-ring": `rgba(${theme.accentRgb}, 0.22)`,
    "--booking-border": `rgba(${theme.accentRgb}, 0.16)`,
    "--booking-border-strong": `rgba(${theme.accentRgb}, 0.3)`,
    "--booking-glow": theme.accentGlow,
    "--booking-panel": theme.panel,
    "--booking-panel-strong": theme.panelStrong,
    "--booking-surface": theme.surface,
    "--booking-surface-elevated": theme.surfaceElevated,
    "--booking-metallic": theme.metallic,
    "--color-accent": theme.accent,
    "--color-accent-rgb": theme.accentRgb,
    "--color-accent-soft": `rgba(${theme.accentRgb}, 0.1)`,
    "--color-accent-contrast": theme.accentContrast,
    "--color-border": `rgba(${theme.accentRgb}, 0.16)`,
    "--color-border-strong": `rgba(${theme.accentRgb}, 0.28)`,
    "--color-panel": theme.panel,
    "--color-panel-strong": theme.panelStrong,
    "--color-surface-glass": theme.surface,
    "--color-surface-subtle": `rgba(${theme.accentRgb}, 0.08)`,
    "--color-surface-elevated": theme.surfaceElevated,
    "--tib-accent-gold": theme.accent,
    "--tib-accent-gold-rgb": theme.accentRgb,
    "--tib-border": `rgba(${theme.accentRgb}, 0.16)`,
    "--tib-border-strong": `rgba(${theme.accentRgb}, 0.28)`,
    "--dashboard-accent": theme.accent,
    "--dashboard-accent-strong": theme.metallic,
    "--dashboard-accent-ring": `rgba(${theme.accentRgb}, 0.18)`,
    "--dashboard-subtle": `rgba(${theme.accentRgb}, 0.74)`,
    "--accent-color": theme.accent,
    "--surface-color": `rgba(${theme.accentRgb}, 0.1)`,
    "--badge-color": `rgba(${theme.accentRgb}, 0.18)`,
    "--button-primary": theme.accent,
    "--highlight": `rgba(${theme.accentRgb}, 0.16)`,
    "--border-subtle": `rgba(${theme.accentRgb}, 0.16)`,
  }
}

const BOOKING_THEME_STYLES: Record<BookingThemeKey, BookingThemeStyle> = {
  neutral: createBookingThemeStyle(BOOKING_THEME_DEFINITIONS.neutral),
  martini: createBookingThemeStyle(BOOKING_THEME_DEFINITIONS.martini),
  corporate: createBookingThemeStyle(BOOKING_THEME_DEFINITIONS.corporate),
  negroni: createBookingThemeStyle(BOOKING_THEME_DEFINITIONS.negroni),
  festival: createBookingThemeStyle(BOOKING_THEME_DEFINITIONS.festival),
}

function normalizeValue(value?: string | null) {
  return value?.trim().toLowerCase() ?? ""
}

function resolveThemeServiceCandidate(value?: string | null) {
  const normalizedValue = normalizeValue(value)
  if (!normalizedValue) return null

  const exactMatch = resolveBookingService(normalizedValue)
  if (exactMatch) return exactMatch

  return (
    ["martini", "corporate", "negroni", "festival"]
      .map((slug) => resolveBookingService(slug))
      .filter(Boolean)
      .find(
        (service) =>
          service &&
          service.aliases.some(
            (alias) =>
              normalizedValue.includes(alias) || alias.includes(normalizedValue),
          ),
      ) ?? null
  )
}

export function resolveBookingThemeKey(input?: BookingThemeInput): BookingThemeKey {
  const candidates = [
    input?.serviceId,
    input?.service,
    input?.serviceType,
    input?.packageName,
    input?.packageLabel,
    input?.eventType,
    input?.category,
  ]

  for (const candidate of candidates) {
    const service = resolveThemeServiceCandidate(candidate)
    if (!service) continue

    if (service.slug === "martini") return "martini"
    if (service.slug === "corporate") return "corporate"
    if (service.slug === "negroni") return "negroni"
    if (service.slug === "festival") return "festival"
  }

  return "neutral"
}

export function getBookingThemeDefinition(input?: BookingThemeInput) {
  return BOOKING_THEME_DEFINITIONS[resolveBookingThemeKey(input)]
}

export function getBookingThemeStyle(input?: BookingThemeInput) {
  return BOOKING_THEME_STYLES[resolveBookingThemeKey(input)]
}
