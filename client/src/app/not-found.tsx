"use client"

import styles from "./not-found.module.css"
import Link from "next/link"
import { useEffect, useState } from "react"

export default function NotFound() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  return (
    <main className={styles.main}>

      {/* Blooms */}
      <div className={styles.bloom} />
      <div className={styles.bloomBottom} />

      {/* Grain */}
      <div className={styles.grain} />

      {/* Vertical rule */}
      <span className={styles.ruleV} />

      {/* Corner labels */}
      <span className={`${styles.corner} ${styles.cornerTL} ${mounted ? styles.in : ""}`}>
        48°N · 2°E
      </span>
      <span className={`${styles.corner} ${styles.cornerTR} ${mounted ? styles.in : ""}`}>
        EST. 2019
      </span>

      {/* Content */}
      <div className={styles.content}>

        {/* Kicker */}
        <div className={`${styles.kickerRow} ${mounted ? styles.fadeUp : ""}`}
             style={{ animationDelay: "0.05s" }}>
          <span className={styles.kickerLine} />
          <span className={styles.kicker}>Error</span>
          <span className={styles.kickerLine} />
        </div>

        {/* 404 */}
        <div className={`${styles.code} ${mounted ? styles.fadeUp : ""}`}
             style={{ animationDelay: "0.15s" }}>
          404
        </div>

        {/* Rule sep */}
        <div className={`${styles.ruleSep} ${mounted ? styles.fadeUp : ""}`}
             style={{ animationDelay: "0.28s" }}>
          <span className={styles.ruleH} />
          <span className={styles.ruleDot} />
          <span className={styles.ruleH} />
        </div>

        {/* Title */}
        <h1 className={`${styles.title} ${mounted ? styles.fadeUp : ""}`}
            style={{ animationDelay: "0.36s" }}>
          Page <em className={styles.titleEm}>Not Found</em>
        </h1>

        {/* Subtitle */}
        <p className={`${styles.subtitle} ${mounted ? styles.fadeUp : ""}`}
           style={{ animationDelay: "0.46s" }}>
          The page you are looking for doesn't exist or has been moved.
        </p>

        {/* Actions */}
        <div className={`${styles.actions} ${mounted ? styles.fadeUp : ""}`}
             style={{ animationDelay: "0.56s" }}>

          <Link href="/" className={styles.primaryBtn}>
            <span className={styles.btnInner}>
              Return Home
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={styles.btnArrow}>
                <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className={styles.btnShine} />
          </Link>

          <Link href="/contact" className={styles.secondaryBtn}>
            <span className={styles.btnInner}>
              Contact Us
            </span>
          </Link>

        </div>

        {/* Services row */}
        <div className={`${styles.services} ${mounted ? styles.fadeUp : ""}`}
             style={{ animationDelay: "0.66s" }}>
          <span className={styles.servicesLabel}>Explore</span>
          {[
            { label: "House Parties", href: "/martini"     },
            { label: "Pool Parties",  href: "/negroni"     },
            { label: "Corporate",     href: "/cosmo"       },
            { label: "Festivals",     href: "/bloody-mary" },
          ].map(s => (
            <Link key={s.href} href={s.href} className={styles.serviceLink}>
              {s.label}
            </Link>
          ))}
        </div>

      </div>

      {/* Scroll indicator style bottom line */}
      <div className={`${styles.bottomRule} ${mounted ? styles.in : ""}`} />

    </main>
  )
}