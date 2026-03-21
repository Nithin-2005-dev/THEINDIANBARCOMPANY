"use client"

import styles from "./Hero.module.css"
import Image from "next/image"
import { useEffect, useState } from "react"

export default function Hero() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  const handleExplorePackages = () => {
    const servicesSection = document.getElementById("services")
    servicesSection?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <section className={styles.hero}>

      {/* VIDEO */}
      <video
        className={styles.video}
        autoPlay muted loop playsInline preload="auto"
      >
        <source src="/videos/party.mp4" type="video/mp4" />
      </video>

      {/* OVERLAYS */}
      <div className={styles.overlayBase}   />
      <div className={styles.overlayTheme}  />
      <div className={styles.overlayBottom} />
      <div className={styles.grain}         />

      {/* CORNER DETAILS */}
      <span className={`${styles.corner} ${styles.cornerTL} ${mounted ? styles.in : ""}`}>
        48°N · 2°E
      </span>
      <span className={`${styles.corner} ${styles.cornerTR} ${mounted ? styles.in : ""}`}>
        EST. 2026
      </span>
      <span className={`${styles.corner} ${styles.cornerBL} ${mounted ? styles.in : ""}`}>
        01 / 01
      </span>

      {/* VERTICAL RULE */}
      <span className={`${styles.ruleV} ${mounted ? styles.in : ""}`} />

      {/* CENTER CONTENT */}
      <div className={styles.center}>

        {/* EMBLEM */}
        <div
          className={`${styles.emblemWrap} ${mounted ? styles.fadeUp : ""}`}
          style={{ animationDelay: "0.05s" }}
        >
          <Image
            src="/images/cocktail.png"
            alt="TIB"
            width={130}
            height={130}
            priority
            className={styles.emblem}
          />
        </div>

        {/* KICKER */}
        <div
          className={`${styles.kickerRow} ${mounted ? styles.fadeUp : ""}`}
          style={{ animationDelay: "0.15s" }}
        >
          <span className={styles.kickerLine} />
          <span className={styles.kicker}>The TIB Bartenders</span>
          <span className={styles.kickerLine} />
        </div>

        {/* TITLE */}
        <h1
          className={`${styles.title} ${mounted ? styles.fadeUp : ""}`}
          style={{ animationDelay: "0.27s" }}
        >
          Elevate Your Party <em className={styles.titleEm}>Experience</em>
        </h1>

        {/* RULE */}
        <div
          className={`${styles.ruleSep} ${mounted ? styles.fadeUp : ""}`}
          style={{ animationDelay: "0.4s" }}
        >
          <span className={styles.ruleH} />
          <span className={styles.ruleDot} />
          <span className={styles.ruleH} />
        </div>

        {/* SUBTITLE */}
        <p
          className={`${styles.subtitle} ${mounted ? styles.fadeUp : ""}`}
          style={{ animationDelay: "0.48s" }}
        >
          Premium cocktail experiences curated for unforgettable celebrations.
        </p>

        {/* BUTTONS */}
        <div
          className={`${styles.buttons} ${mounted ? styles.fadeUp : ""}`}
          style={{ animationDelay: "0.6s" }}
        >

          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleExplorePackages}
          >
            <span className={styles.btnInner}>
              Explore Packages
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={styles.btnArrow}>
                <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className={styles.btnShine} />
          </button>

          <button className={styles.secondaryBtn}>
            <span className={styles.btnInner}>
              Book Now
            </span>
          </button>

        </div>

      </div>

      {/* SCROLL INDICATOR */}
      <div className={`${styles.scroll} ${mounted ? styles.in : ""}`}>
        <span className={styles.scrollLine} />
        <span className={styles.scrollLabel}>Scroll</span>
      </div>

    </section>
  )
}
