"use client"

import { useEffect, useRef, useState } from "react"
import { ThemeIcon } from "@/components/dashboard/icons"
import {
  DASHBOARD_THEME_OPTIONS,
  type DashboardThemeKey,
} from "@/components/dashboard/dashboard-theme"
import styles from "@/components/dashboard/header/HeaderThemeMenu.module.css"

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

export function HeaderThemeMenu({
  theme,
  onChange,
}: {
  theme: DashboardThemeKey
  onChange: (theme: DashboardThemeKey) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const activeTheme =
    DASHBOARD_THEME_OPTIONS.find((option) => option.key === theme) ??
    DASHBOARD_THEME_OPTIONS[0]

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    window.addEventListener("mousedown", handlePointerDown)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("mousedown", handlePointerDown)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={joinClasses(styles.trigger, open && styles.triggerOpen)}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Choose dashboard theme"
      >
        <span
          className={styles.swatch}
          style={{ "--theme-accent": activeTheme.accent } as React.CSSProperties}
        >
          <ThemeIcon width={15} height={15} />
        </span>
        <span className={styles.meta}>
          <span className={styles.label}>Theme</span>
          <span className={styles.value}>{activeTheme.label}</span>
        </span>
      </button>

      {open ? (
        <div className={styles.menu} role="menu">
          <div className={styles.summary}>
            <p className={styles.menuLabel}>Dashboard theme</p>
            <p className={styles.menuCopy}>
              Switch the shared shell palette across all dashboard sections.
            </p>
          </div>

          <div className={styles.options}>
            {DASHBOARD_THEME_OPTIONS.map((option) => {
              const isActive = option.key === theme
              return (
                <button
                  key={option.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={joinClasses(
                    styles.option,
                    isActive && styles.optionActive,
                  )}
                  onClick={() => {
                    onChange(option.key)
                    setOpen(false)
                  }}
                >
                  <span
                    className={styles.optionSwatch}
                    style={
                      { "--theme-accent": option.accent } as React.CSSProperties
                    }
                  />
                  <span className={styles.optionMeta}>
                    <span className={styles.optionLabel}>{option.label}</span>
                    <span className={styles.optionDescription}>
                      {option.description}
                    </span>
                  </span>
                  {isActive ? (
                    <span className={styles.optionBadge}>Active</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
