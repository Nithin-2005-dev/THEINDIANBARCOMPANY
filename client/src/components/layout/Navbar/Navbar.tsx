"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { fetchSharedAuthSession, getPostLoginRedirectPath } from "@/lib/login-auth"
import styles from "./Navbar.module.css"

const NAV_LINKS = [
  { href: "/",          label: "Home",     accent: "var(--tib-accent)"     },
  { href: "/#services", label: "Services", accent: "var(--tib-accent)"     },
  { href: "/booking",   label: "Booking",  accent: "var(--tib-accent)"     },
  { href: "/#about",    label: "About",    accent: "var(--tib-accent)"     },
  { href: "/team",      label: "Team",     accent: "var(--tib-accent)"     },
]

function isNavLinkActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/"
  }

  if (href === "/booking") {
    return pathname === "/booking" || pathname.startsWith("/booking/")
  }

  if (href.startsWith("/#")) {
    return false
  }

  return pathname === href
}

function CloseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="6" height="10" viewBox="0 0 6 10" fill="none" className={styles.chevron}>
      <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function Navbar() {
  const pathname                    = usePathname()
  const [open, setOpen]             = useState(false)
  const [scrolled, setScrolled]     = useState(false)
  const [dashboardHref, setDashboardHref] = useState<string | null>(null)
  const pillRef                     = useRef<HTMLSpanElement>(null)
  const navRef                      = useRef<HTMLElement>(null)

  /* Scroll detection */
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8)
    window.addEventListener("scroll", fn, { passive: true })
    return () => window.removeEventListener("scroll", fn)
  }, [])

  /* Auth session */
  useEffect(() => {
    let active = true
    fetchSharedAuthSession()
      .then(data => { if (active) setDashboardHref(getPostLoginRedirectPath(data.user.role)) })
      .catch(() => { if (active) setDashboardHref(null) })
    return () => { active = false }
  }, [pathname])

  /* Body scroll lock */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  /* Close sheet on resize */
  useEffect(() => {
    const fn = () => { if (window.innerWidth > 900) setOpen(false) }
    window.addEventListener("resize", fn)
    return () => window.removeEventListener("resize", fn)
  }, [])

  /* Glide pill */
  const movePill = (el: HTMLElement) => {
    const nav  = navRef.current
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

  const utilityLink = useMemo(() => (
    dashboardHref
      ? { href: dashboardHref, label: "Dashboard" }
      : { href: "/login",      label: "Login"     }
  ), [dashboardHref])

  return (
    <>
      <header className={`${styles.wrapper} ${scrolled ? styles.scrolled : ""}`}>
        <div className={styles.island}>

          {/* LOGO */}
          <Link href="/" className={styles.logo}>
            <span className={styles.logoRing}>
              <Image
                src="/logo.png"
                alt="TIB"
                width={16}
                height={16}
                priority
                style={{ width: "auto", height: "auto" }}
              />
            </span>
            <span className={styles.brand}>The Indian Bar</span>
          </Link>

          {/* NAV */}
          <nav
            ref={navRef}
            className={styles.nav}
            onMouseLeave={hidePill}
          >
            <span ref={pillRef} className={styles.glidePill} aria-hidden="true" />

            {NAV_LINKS.map(({ href, label, accent }) => (
              <Link
                key={href}
                href={href}
                className={`${styles.link} ${isNavLinkActive(pathname, href) ? styles.linkActive : ""}`}
                style={{ "--accent": accent } as React.CSSProperties}
                onMouseEnter={e => movePill(e.currentTarget)}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* ACTIONS */}
          <div className={styles.actions}>
            <Link href={utilityLink.href} className={styles.ctaBtn}>
              <span className={styles.ctaInner}>
                {utilityLink.label}
              </span>
              <span className={styles.ctaShine} />
            </Link>

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

        </div>
      </header>

      {/* BACKDROP */}
      <div
        className={`${styles.backdrop} ${open ? styles.show : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* SHEET */}
      <div
        className={`${styles.sheet} ${open ? styles.open : ""}`}
        role="dialog"
        aria-modal="true"
      >

        {/* Sheet top */}
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

        {/* Sheet nav */}
        <nav className={styles.sheetNav}>
          {NAV_LINKS.map(({ href, label, accent }, i) => (
            <Link
              key={href}
              href={href}
              className={`${styles.mobileLink} ${isNavLinkActive(pathname, href) ? styles.mobileLinkActive : ""}`}
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

          {/* Utility link */}
          <Link
            href={utilityLink.href}
            className={styles.sheetCta}
            style={{
              transitionDelay: open ? `${NAV_LINKS.length * 55 + 60}ms` : "0ms",
            }}
            onClick={() => setOpen(false)}
          >
            {utilityLink.label}
          </Link>
        </nav>

        {/* Footer line */}
        <div className={styles.sheetFoot}>
          <span className={styles.footLine} />
        </div>

      </div>
    </>
  )
}
