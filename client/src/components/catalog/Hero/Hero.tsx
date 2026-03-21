"use client"

import styles from "./Hero.module.css"
import { useEffect, useState } from "react"

type HeroProps = {
  tag: string
  title: string
  subtitle: string
  video: string
  primaryCta?: string
  secondaryCta?: string
}

function SplitTitle({ text }: { text: string }) {
  const words = text.trim().split(" ")
  const last  = words.pop()
  return (
    <>
      {words.join(" ")}{" "}
      <em className={styles.titleEm}>{last}</em>
    </>
  )
}

export default function Hero({
  tag,
  title,
  subtitle,
  video,
  primaryCta   = "Explore Packages",
  secondaryCta = "Get Custom Quote",
}: HeroProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  const handleExplorePackages = () => {
    const packagesSection = document.getElementById("packages")
    packagesSection?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const handleCustomQuote = () => {
    const finalCtaSection = document.getElementById("final-cta")
    finalCtaSection?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <section className={styles.hero}>

      <video className={styles.video} autoPlay muted loop playsInline>
        <source src={video} type="video/mp4" />
      </video>

      <div className={styles.gradientBase}   />
      <div className={styles.gradientTheme}  />
      <div className={styles.gradientBottom} />
      <div className={styles.grain}          />

      <span className={`${styles.corner} ${styles.cornerTL} ${mounted ? styles.in : ""}`}>
        48°N · 2°E
      </span>
      <span className={`${styles.corner} ${styles.cornerTR} ${mounted ? styles.in : ""}`}>
        EST. 2026
      </span>
      <span className={`${styles.corner} ${styles.cornerBL} ${mounted ? styles.in : ""}`}>
        01 / 01
      </span>

      <span className={`${styles.ruleV} ${mounted ? styles.in : ""}`} />

      <div className={styles.content}>

        <div
          className={`${styles.kickerRow} ${mounted ? styles.fadeUp : ""}`}
          style={{ animationDelay: "0.1s" }}
        >
          <span className={styles.kickerLine} />
          <span className={styles.kicker}>{tag}</span>
          <span className={styles.kickerLine} />
        </div>

        <h1
          className={`${styles.title} ${mounted ? styles.fadeUp : ""}`}
          style={{ animationDelay: "0.22s" }}
        >
          <SplitTitle text={title} />
        </h1>

        <div
          className={`${styles.ruleSep} ${mounted ? styles.fadeUp : ""}`}
          style={{ animationDelay: "0.38s" }}
        >
          <span className={styles.ruleH} />
          <span className={styles.ruleDot} />
          <span className={styles.ruleH} />
        </div>

        <p
          className={`${styles.subtitle} ${mounted ? styles.fadeUp : ""}`}
          style={{ animationDelay: "0.46s" }}
        >
          {subtitle}
        </p>

        <div
          className={`${styles.actions} ${mounted ? styles.fadeUp : ""}`}
          style={{ animationDelay: "0.6s" }}
        >

          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleExplorePackages}
          >
            <span className={styles.btnInner}>
              {primaryCta}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={styles.btnArrow}>
                <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className={styles.btnShine} />
          </button>

          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={handleCustomQuote}
          >
            <span className={styles.btnInner}>
              {secondaryCta}
            </span>
          </button>

        </div>

      </div>

      <div className={`${styles.scroll} ${mounted ? styles.in : ""}`}>
        <span className={styles.scrollLine} />
        <span className={styles.scrollLabel}>Scroll</span>
      </div>

    </section>
  )
}
