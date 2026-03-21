"use client"

import styles from "./Packages.module.css"
import { useState } from "react"

type Package = {
  name: string
  guests: string
  price: string
  popular?: boolean
  features: string[]
}

type PackagesProps = {
  title: string
  subtitle: string
  packages: Package[]
}

export default function Packages({ title, subtitle, packages }: PackagesProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <section id="packages" className={styles.section}>

      {/* HEADER */}
      <div className={styles.header}>
        <span className={styles.kicker}>
          <span className={styles.kickerLine} />
          Pricing
          <span className={styles.kickerLine} />
        </span>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>

      {/* GRID */}
      <div className={styles.grid}>
        {packages.map((pkg, i) => (
          <div
            key={pkg.name}
            className={`${styles.card} ${pkg.popular ? styles.popular : ""} ${hovered === pkg.name ? styles.cardHovered : ""}`}
            onMouseEnter={() => setHovered(pkg.name)}
            onMouseLeave={() => setHovered(null)}
          >

            {/* Ambient glow */}
            <div className={styles.cardGlow} />

            {/* Popular badge */}
            {pkg.popular && (
              <div className={styles.badge}>
                <span className={styles.badgeDot} />
                Most Popular
              </div>
            )}

            {/* Index */}
            <span className={styles.index}>0{i + 1}</span>

            {/* Name */}
            <h3 className={styles.name}>{pkg.name}</h3>

            {/* Guests */}
            <p className={styles.guests}>{pkg.guests}</p>

            {/* Divider */}
            <div className={styles.divider} />

            {/* Price */}
            <div className={styles.priceRow}>
              <span className={styles.price}>{pkg.price}</span>
              <span className={styles.perEvent}>/ event</span>
            </div>

            {/* Features */}
            <ul className={styles.features}>
              {pkg.features.map((f, fi) => (
                <li key={fi} className={styles.feature}>
                  <span className={styles.check}>
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button className={`${styles.cta} ${pkg.popular ? styles.ctaPrimary : styles.ctaGhost}`}>
              <span className={styles.ctaInner}>
                Get Quote
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className={styles.ctaArrow}>
                  <path d="M1 6.5h11M7 2l4.5 4.5L7 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className={styles.ctaShine} />
            </button>

          </div>
        ))}
      </div>

    </section>
  )
}
