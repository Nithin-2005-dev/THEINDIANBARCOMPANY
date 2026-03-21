"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import styles from "./Navbar.module.css"

const NAV_LINKS = [
  { href: "/",            label: "TIB",           theme: "tib",     accent: "#f59e0b" },
  { href: "/martini",     label: "House Parties", theme: "martini", accent: "#d10f1b" },
  { href: "/negroni",     label: "Pool Parties",  theme: "negroni", accent: "#2dd4bf" },
  { href: "/cosmo",       label: "Corporate",     theme: "cosmo",   accent: "#c084fc" },
  { href: "/bloody-mary", label: "Festivals",     theme: "bm",      accent: "#ef4444" },
]

export default function Header() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const pathname = usePathname()

  const pillRef = useRef<HTMLSpanElement>(null)
  const navRef  = useRef<HTMLElement>(null)

  /* Scroll detection */
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8)
    window.addEventListener("scroll", fn, { passive: true })
    return () => window.removeEventListener("scroll", fn)
  }, [])

  /* Close sheet on desktop resize */
  useEffect(() => {
    const fn = () => { if (window.innerWidth > 900) setOpen(false) }
    window.addEventListener("resize", fn)
    return () => window.removeEventListener("resize", fn)
  }, [])

  /* Body scroll lock */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  /* Glide pill movement */
  const movePill = (el: HTMLElement) => {
    const nav = navRef.current
    const pill = pillRef.current
    if (!nav || !pill) return

    const navRect = nav.getBoundingClientRect()
    const elRect  = el.getBoundingClientRect()

    pill.style.width   = `${elRect.width}px`
    pill.style.left    = `${elRect.left - navRect.left}px`
    pill.style.opacity = "1"
  }

  const hidePill = () => {
    if (pillRef.current) pillRef.current.style.opacity = "0"
  }

  /* Active check (supports nested routes) */
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* HEADER */}
      <header className={`${styles.wrapper} ${scrolled ? styles.scrolled : ""}`}>
        <div className={styles.island}>

          {/* LOGO */}
          <Link href="/" className={styles.logo}>
            <span className={styles.logoRing}>
              <Image src="/logo.png" alt="TIB" width={16} height={16} priority />
            </span>
            <span className={styles.brand}>TIB</span>
          </Link>

          {/* CENTER NAV */}
          <nav
            ref={navRef}
            className={styles.nav}
            onMouseLeave={hidePill}
          >
            <span ref={pillRef} className={styles.glidePill} aria-hidden="true" />

            {NAV_LINKS.map(({ href, label, theme, accent }) => (
              <Link
                key={href}
                href={href}
                className={`${styles.link} ${isActive(href) ? styles.linkActive : ""}`}
                style={{ "--accent": accent } as React.CSSProperties}
                data-theme={theme}
                onMouseEnter={e => movePill(e.currentTarget)}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* HAMBURGER */}
          <button
            className={styles.menuBtn}
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
          >
            <span className={styles.bar} />
            <span className={styles.bar} />
          </button>

        </div>
      </header>

      {/* BACKDROP */}
      <div
        className={`${styles.backdrop} ${open ? styles.show : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* MOBILE SHEET */}
      <div
        className={`${styles.sheet} ${open ? styles.open : ""}`}
        role="dialog"
        aria-modal="true"
      >
        {/* Top */}
        <div className={styles.sheetTop}>
          <span className={styles.sheetBrand}>TIB</span>
          <button
            className={styles.closeBtn}
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Links */}
        <nav className={styles.sheetNav}>
          {NAV_LINKS.map(({ href, label, accent }, i) => (
            <Link
              key={href}
              href={href}
              className={`${styles.mobileLink} ${isActive(href) ? styles.mobileLinkActive : ""}`}
              style={{
                "--accent": accent,
                transitionDelay: open ? `${i * 55 + 60}ms` : "0ms",
              } as React.CSSProperties}
              onClick={() => setOpen(false)}
            >
              <span className={styles.mobileLinkInner}>
                <span className={styles.mobileDot} />
                <span className={styles.mobileLinkLabel}>{label}</span>
              </span>
              <ChevronRight />
            </Link>
          ))}
        </nav>

        {/* Ambient footer */}
        <div className={styles.sheetFoot}>
          <span className={styles.footLine} />
        </div>
      </div>
    </>
  )
}

/* ───────── ICONS ───────── */

function CloseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
      <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}