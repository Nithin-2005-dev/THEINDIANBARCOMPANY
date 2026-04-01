import type { CSSProperties } from "react"

export type DashboardThemeKey =
  | "tib"
  | "martini"
  | "cosmo"
  | "negroni"
  | "bloody-mary"

type DashboardThemeDefinition = {
  accent: string
  accentContrast: string
  accentRgb: string
  accentStrong: string
  bg: string
  bgSecondary: string
  bgTertiary: string
  surface: string
  surfaceElevated: string
  surfaceSubtle: string
  border: string
  borderStrong: string
  borderSoft: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  success: string
  successRgb: string
  warning: string
  warningRgb: string
  danger: string
  dangerRgb: string
  panel: string
  panelStrong: string
  surfaceGlass: string
  bookingGlow: string
  bookingSurface: string
  bookingSurfaceElevated: string
  metallic: string
}

type DashboardThemeStyle = CSSProperties & Record<`--${string}`, string>

export type DashboardThemeOption = {
  key: DashboardThemeKey
  label: string
  description: string
  accent: string
}

const SHARED_STATUS = {
  success: "#4f9b72",
  successRgb: "79, 155, 114",
  warning: "#c48d32",
  warningRgb: "196, 141, 50",
  danger: "#b75a4b",
  dangerRgb: "183, 90, 75",
}

const DASHBOARD_THEME_DEFINITIONS: Record<
  DashboardThemeKey,
  DashboardThemeDefinition
> = {
  tib: {
    accent: "#ff7a1a",
    accentContrast: "#090909",
    accentRgb: "255, 122, 26",
    accentStrong: "#ffb06d",
    bg: "#020202",
    bgSecondary: "#060606",
    bgTertiary: "#0a0a0a",
    surface: "#0c0c0c",
    surfaceElevated: "#141414",
    surfaceSubtle: "rgba(255, 255, 255, 0.024)",
    border: "rgba(255, 122, 26, 0.18)",
    borderStrong: "rgba(255, 122, 26, 0.3)",
    borderSoft: "rgba(255, 255, 255, 0.08)",
    textPrimary: "#ffffff",
    textSecondary: "#dfdfdf",
    textMuted: "#929292",
    panel: "rgba(5, 5, 5, 0.92)",
    panelStrong: "rgba(1, 1, 1, 0.97)",
    surfaceGlass: "rgba(12, 12, 12, 0.9)",
    bookingGlow: "rgba(255, 122, 26, 0.24)",
    bookingSurface:
      "linear-gradient(180deg, rgba(255, 122, 26, 0.08), rgba(255, 255, 255, 0.02))",
    bookingSurfaceElevated:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 122, 26, 0.05))",
    metallic: "#fff6ee",
    ...SHARED_STATUS,
  },
  martini: {
    accent: "#e0a93b",
    accentContrast: "#1b1204",
    accentRgb: "224, 169, 59",
    accentStrong: "#f3cc7a",
    bg: "#090603",
    bgSecondary: "#100b05",
    bgTertiary: "#171109",
    surface: "#15100a",
    surfaceElevated: "#20160d",
    surfaceSubtle: "rgba(255, 228, 163, 0.038)",
    border: "rgba(224, 169, 59, 0.14)",
    borderStrong: "rgba(224, 169, 59, 0.22)",
    borderSoft: "rgba(255, 239, 208, 0.07)",
    textPrimary: "#f7f1e6",
    textSecondary: "#c6b394",
    textMuted: "#9d8f7b",
    panel: "rgba(16, 10, 6, 0.92)",
    panelStrong: "rgba(12, 8, 5, 0.97)",
    surfaceGlass: "rgba(22, 15, 9, 0.9)",
    bookingGlow: "rgba(224, 169, 59, 0.3)",
    bookingSurface:
      "linear-gradient(180deg, rgba(224, 169, 59, 0.12), rgba(255, 214, 136, 0.03))",
    bookingSurfaceElevated:
      "linear-gradient(180deg, rgba(255, 221, 158, 0.16), rgba(224, 169, 59, 0.05))",
    metallic: "#ffe2a6",
    ...SHARED_STATUS,
  },
  cosmo: {
    accent: "#d6d9df",
    accentContrast: "#15171b",
    accentRgb: "214, 217, 223",
    accentStrong: "#ffffff",
    bg: "#07090c",
    bgSecondary: "#0d1116",
    bgTertiary: "#11161d",
    surface: "#11161c",
    surfaceElevated: "#171e27",
    surfaceSubtle: "rgba(240, 244, 252, 0.03)",
    border: "rgba(214, 217, 223, 0.12)",
    borderStrong: "rgba(214, 217, 223, 0.18)",
    borderSoft: "rgba(244, 247, 252, 0.06)",
    textPrimary: "#f5f7fb",
    textSecondary: "#aeb7c2",
    textMuted: "#7e8894",
    panel: "rgba(12, 15, 19, 0.92)",
    panelStrong: "rgba(10, 12, 16, 0.97)",
    surfaceGlass: "rgba(18, 23, 29, 0.9)",
    bookingGlow: "rgba(214, 217, 223, 0.22)",
    bookingSurface:
      "linear-gradient(180deg, rgba(214, 217, 223, 0.08), rgba(214, 217, 223, 0.02))",
    bookingSurfaceElevated:
      "linear-gradient(180deg, rgba(247, 248, 251, 0.14), rgba(214, 217, 223, 0.04))",
    metallic: "#f3f6fb",
    ...SHARED_STATUS,
  },
  negroni: {
    accent: "#5bd6cb",
    accentContrast: "#071716",
    accentRgb: "91, 214, 203",
    accentStrong: "#c9fffa",
    bg: "#04090a",
    bgSecondary: "#071011",
    bgTertiary: "#0b1618",
    surface: "#0c1718",
    surfaceElevated: "#112021",
    surfaceSubtle: "rgba(166, 248, 242, 0.03)",
    border: "rgba(91, 214, 203, 0.13)",
    borderStrong: "rgba(91, 214, 203, 0.2)",
    borderSoft: "rgba(215, 255, 252, 0.06)",
    textPrimary: "#eef9f8",
    textSecondary: "#9ec7c3",
    textMuted: "#769694",
    panel: "rgba(7, 17, 18, 0.92)",
    panelStrong: "rgba(6, 13, 14, 0.97)",
    surfaceGlass: "rgba(12, 24, 25, 0.9)",
    bookingGlow: "rgba(91, 214, 203, 0.28)",
    bookingSurface:
      "linear-gradient(180deg, rgba(91, 214, 203, 0.12), rgba(85, 199, 255, 0.03))",
    bookingSurfaceElevated:
      "linear-gradient(180deg, rgba(119, 235, 225, 0.16), rgba(91, 214, 203, 0.05))",
    metallic: "#c9fffa",
    ...SHARED_STATUS,
  },
  "bloody-mary": {
    accent: "#cc3f2c",
    accentContrast: "#fff4ef",
    accentRgb: "204, 63, 44",
    accentStrong: "#ffd1a3",
    bg: "#080302",
    bgSecondary: "#110706",
    bgTertiary: "#190c09",
    surface: "#170d0b",
    surfaceElevated: "#21110e",
    surfaceSubtle: "rgba(255, 210, 193, 0.03)",
    border: "rgba(204, 63, 44, 0.14)",
    borderStrong: "rgba(204, 63, 44, 0.22)",
    borderSoft: "rgba(255, 233, 222, 0.06)",
    textPrimary: "#faf0ea",
    textSecondary: "#c8a899",
    textMuted: "#9a7c71",
    panel: "rgba(18, 7, 6, 0.92)",
    panelStrong: "rgba(13, 6, 5, 0.97)",
    surfaceGlass: "rgba(25, 12, 10, 0.9)",
    bookingGlow: "rgba(204, 63, 44, 0.3)",
    bookingSurface:
      "linear-gradient(180deg, rgba(204, 63, 44, 0.13), rgba(255, 201, 127, 0.03))",
    bookingSurfaceElevated:
      "linear-gradient(180deg, rgba(255, 183, 109, 0.14), rgba(204, 63, 44, 0.06))",
    metallic: "#ffd1a3",
    ...SHARED_STATUS,
  },
}

export const DASHBOARD_THEME_OPTIONS: DashboardThemeOption[] = [
  {
    key: "tib",
    label: "TIB",
    description: "Default brand palette for the dashboard shell.",
    accent: DASHBOARD_THEME_DEFINITIONS.tib.accent,
  },
  {
    key: "cosmo",
    label: "Cosmo",
    description: "Crisp slate and platinum tones for a polished event look.",
    accent: DASHBOARD_THEME_DEFINITIONS.cosmo.accent,
  },
  {
    key: "martini",
    label: "Martini",
    description: "Warm gold service palette with a polished hospitality feel.",
    accent: DASHBOARD_THEME_DEFINITIONS.martini.accent,
  },
  {
    key: "negroni",
    label: "Negroni",
    description: "Deep teal surfaces with a premium modern contrast.",
    accent: DASHBOARD_THEME_DEFINITIONS.negroni.accent,
  },
  {
    key: "bloody-mary",
    label: "Bloody Mary",
    description: "Rich copper warmth with a bold event-service tone.",
    accent: DASHBOARD_THEME_DEFINITIONS["bloody-mary"].accent,
  },
]

function normalizeDashboardThemeKey(value: string): DashboardThemeKey | null {
  if (value === "corporate") return "cosmo"
  if (value === "festival") return "bloody-mary"

  return DASHBOARD_THEME_OPTIONS.some((theme) => theme.key === value)
    ? (value as DashboardThemeKey)
    : null
}

export function isDashboardThemeKey(value: string): value is DashboardThemeKey {
  return normalizeDashboardThemeKey(value) !== null
}

export function resolveDashboardThemeKey(
  value?: string | null,
): DashboardThemeKey {
  if (!value) return "tib"
  return normalizeDashboardThemeKey(value) ?? "tib"
}

export function getDashboardThemeOptions() {
  return DASHBOARD_THEME_OPTIONS
}

export function getDashboardThemeStyle(
  key: DashboardThemeKey,
): DashboardThemeStyle {
  const theme = DASHBOARD_THEME_DEFINITIONS[key]

  return {
    "--color-bg": theme.bg,
    "--color-bg-secondary": theme.bgSecondary,
    "--dashboard-bg-tertiary": theme.bgTertiary,
    "--color-surface": theme.surface,
    "--color-surface-elevated": theme.surfaceElevated,
    "--color-surface-subtle": theme.surfaceSubtle,
    "--color-border": theme.border,
    "--color-border-strong": theme.borderStrong,
    "--color-border-soft": theme.borderSoft,
    "--color-text-primary": theme.textPrimary,
    "--color-text-secondary": theme.textSecondary,
    "--color-text-muted": theme.textMuted,
    "--color-accent": theme.accent,
    "--color-accent-contrast": theme.accentContrast,
    "--color-accent-soft": `rgba(${theme.accentRgb}, 0.08)`,
    "--color-accent-rgb": theme.accentRgb,
    "--color-success": theme.success,
    "--color-success-rgb": theme.successRgb,
    "--color-warning": theme.warning,
    "--color-warning-rgb": theme.warningRgb,
    "--color-danger": theme.danger,
    "--color-danger-rgb": theme.dangerRgb,
    "--color-panel": theme.panel,
    "--color-panel-strong": theme.panelStrong,
    "--color-surface-glass": theme.surfaceGlass,
    "--tib-bg": theme.bg,
    "--tib-surface": theme.surface,
    "--tib-surface-2": theme.surfaceElevated,
    "--tib-text-primary": theme.textPrimary,
    "--tib-text-secondary": theme.textSecondary,
    "--tib-accent-gold": theme.accent,
    "--tib-accent-gold-rgb": theme.accentRgb,
    "--tib-border": theme.border,
    "--tib-border-strong": theme.borderStrong,
    "--tib-success": theme.success,
    "--tib-success-rgb": theme.successRgb,
    "--tib-warning": theme.warning,
    "--tib-warning-rgb": theme.warningRgb,
    "--tib-danger": theme.danger,
    "--tib-danger-rgb": theme.dangerRgb,
    "--tib-surface-soft": theme.surfaceSubtle,
    "--tib-surface-glass": theme.surfaceGlass,
    "--dashboard-bg": theme.bg,
    "--dashboard-bg-secondary": theme.bgSecondary,
    "--dashboard-panel": theme.panel,
    "--dashboard-panel-strong": theme.panelStrong,
    "--dashboard-panel-soft": theme.surfaceSubtle,
    "--dashboard-surface": theme.surfaceGlass,
    "--dashboard-surface-elevated": theme.surfaceElevated,
    "--dashboard-border": theme.border,
    "--dashboard-border-strong": theme.borderStrong,
    "--dashboard-border-soft": theme.borderSoft,
    "--dashboard-text": theme.textPrimary,
    "--dashboard-muted": theme.textSecondary,
    "--dashboard-subtle": `rgba(${theme.accentRgb}, 0.68)`,
    "--dashboard-success": theme.success,
    "--dashboard-warning": theme.warning,
    "--dashboard-danger": theme.danger,
    "--dashboard-accent": theme.accent,
    "--dashboard-accent-strong": theme.accentStrong,
    "--dashboard-accent-ring": `rgba(${theme.accentRgb}, 0.14)`,
    "--booking-accent": theme.accent,
    "--booking-accent-rgb": theme.accentRgb,
    "--booking-accent-soft": `rgba(${theme.accentRgb}, 0.08)`,
    "--booking-highlight": `rgba(${theme.accentRgb}, 0.12)`,
    "--booking-highlight-strong": `rgba(${theme.accentRgb}, 0.18)`,
    "--booking-focus-ring": `rgba(${theme.accentRgb}, 0.22)`,
    "--booking-border": theme.border,
    "--booking-border-strong": theme.borderStrong,
    "--booking-glow": theme.bookingGlow,
    "--booking-panel": theme.panel,
    "--booking-panel-strong": theme.panelStrong,
    "--booking-surface": theme.bookingSurface,
    "--booking-surface-elevated": theme.bookingSurfaceElevated,
    "--booking-metallic": theme.metallic,
    "--accent-color": theme.accent,
    "--surface-color": `rgba(${theme.accentRgb}, 0.1)`,
    "--badge-color": `rgba(${theme.accentRgb}, 0.18)`,
    "--button-primary": theme.accent,
    "--highlight": `rgba(${theme.accentRgb}, 0.16)`,
    "--border-subtle": theme.border,
  }
}
