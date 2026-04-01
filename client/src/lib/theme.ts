import type { CSSProperties } from "react"

export type ThemeName = "martini" | "negroni" | "cosmo" | "bm" | "tib"

type ThemeStyle = CSSProperties & Record<`--${string}`, string>

export const themeColors: Record<ThemeName, string> = {
  martini: "#d10f1b",
  negroni: "#2dd4bf",
  cosmo: "#c084fc",
  bm: "#ef4444",
  tib: "#ff7a1a",
}

export const themeStyles: Record<ThemeName, ThemeStyle> = {
  martini: {
    "--primary": "var(--martini-primary)",
    "--accent": "var(--martini-accent)",
    "--bg": "var(--martini-bg)",
    "--scene-surface-bg":
      "linear-gradient(180deg, color-mix(in srgb, var(--martini-bg) 48%, transparent), color-mix(in srgb, var(--martini-bg) 62%, transparent))",
    "--scene-surface-edge": "color-mix(in srgb, var(--martini-bg) 82%, transparent)",
  },
  negroni: {
    "--primary": "var(--negroni-primary)",
    "--accent": "var(--negroni-accent)",
    "--bg": "var(--negroni-bg)",
    "--scene-surface-bg":
      "linear-gradient(180deg, color-mix(in srgb, var(--negroni-bg) 48%, transparent), color-mix(in srgb, var(--negroni-bg) 62%, transparent))",
    "--scene-surface-edge": "color-mix(in srgb, var(--negroni-bg) 82%, transparent)",
  },
  cosmo: {
    "--primary": "var(--cosmo-primary)",
    "--accent": "var(--cosmo-accent)",
    "--bg": "var(--cosmo-bg)",
    "--scene-surface-bg":
      "linear-gradient(180deg, color-mix(in srgb, var(--cosmo-bg) 48%, transparent), color-mix(in srgb, var(--cosmo-bg) 62%, transparent))",
    "--scene-surface-edge": "color-mix(in srgb, var(--cosmo-bg) 82%, transparent)",
  },
  bm: {
    "--primary": "var(--bm-primary)",
    "--accent": "var(--bm-accent)",
    "--bg": "var(--bm-bg)",
    "--scene-surface-bg":
      "linear-gradient(180deg, color-mix(in srgb, var(--bm-bg) 48%, transparent), color-mix(in srgb, var(--bm-bg) 62%, transparent))",
    "--scene-surface-edge": "color-mix(in srgb, var(--bm-bg) 82%, transparent)",
  },
  tib: {
    "--primary": "var(--tib-primary)",
    "--accent": "var(--tib-accent)",
    "--bg": "var(--tib-bg)",
    "--scene-surface-bg":
      "linear-gradient(180deg, color-mix(in srgb, var(--tib-bg) 48%, transparent), color-mix(in srgb, var(--tib-bg) 62%, transparent))",
    "--scene-surface-edge": "color-mix(in srgb, var(--tib-bg) 82%, transparent)",
  },
}

export function resolveThemeName(pathname: string): ThemeName {
  if (pathname.startsWith("/martini")) return "martini"
  if (pathname.startsWith("/negroni")) return "negroni"
  if (pathname.startsWith("/cosmo")) return "cosmo"
  if (pathname.startsWith("/bloody-mary")) return "bm"
  return "tib"
}
