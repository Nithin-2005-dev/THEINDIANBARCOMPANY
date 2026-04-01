"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  ChevronDownIcon,
  HomeIcon,
  LogoutIcon,
} from "@/components/dashboard/icons"
import styles from "@/components/dashboard/header/HeaderUserMenu.module.css"

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

export function HeaderUserMenu({
  initials,
  name,
  subtitle,
  homeHref,
  onLogout,
}: {
  initials: string
  name: string
  subtitle: string
  homeHref: string
  onLogout?: () => Promise<void> | void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)

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
        aria-label="Open user menu"
      >
        <span className={styles.avatar}>{initials}</span>
        <span className={styles.meta}>
          <span className={styles.name}>{name}</span>
          <span className={styles.subtitle}>{subtitle}</span>
        </span>
        <ChevronDownIcon className={joinClasses(styles.chevron, open && styles.chevronOpen)} />
      </button>

      {open ? (
        <div className={styles.menu} role="menu">
          <div className={styles.summary}>
            <p className={styles.name}>{name}</p>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>

          <Link
            href={homeHref}
            className={styles.menuItem}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <HomeIcon width={16} height={16} />
            <span>Go to home</span>
          </Link>

          <button
            type="button"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => {
              setOpen(false)
              void onLogout?.()
            }}
          >
            <LogoutIcon width={16} height={16} />
            <span>Log out</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
