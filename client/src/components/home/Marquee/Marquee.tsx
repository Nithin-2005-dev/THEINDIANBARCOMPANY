"use client"

import { useEffect, useRef } from "react"
import styles from "./Marquee.module.css"

const ITEMS = [
  "Luxury Experience",
  "VIP Parties",
  "Premium Events",
  "Celebrations",
  "Bespoke Cocktails",
  "Unforgettable Nights",
]

export default function Marquee() {
  const topRef    = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      if (topRef.current)
        topRef.current.style.transform    = `translate3d(${-y * 0.08}px, 0, 0)`
      if (bottomRef.current)
        bottomRef.current.style.transform = `translate3d(${y * 0.06}px, 0, 0)`
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  /* Triple-repeat so parallax offset never reveals empty space */
  const repeated = [...ITEMS, ...ITEMS, ...ITEMS]

  return (
    <section className={styles.section}>

      {/* Ambient bloom */}
      <div className={styles.bloom} />

      {/* Top ruled line */}
      <span className={styles.ruleTop} />

      {/* ROW 1 — moves left on scroll */}
      <div className={styles.row}>
        <div ref={topRef} className={`${styles.track} ${styles.trackTop}`}>
          {repeated.map((item, i) => (
            <span key={i} className={styles.item}>
              <span className={styles.itemText}>{item}</span>
              <span className={styles.separator}>
                <span className={styles.sepDot} />
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ROW 2 — moves right on scroll, muted */}
      <div className={styles.row}>
        <div ref={bottomRef} className={`${styles.track} ${styles.trackBottom}`}>
          {repeated.map((item, i) => (
            <span key={i} className={styles.item}>
              <span className={styles.itemTextMuted}>{item}</span>
              <span className={styles.separator}>
                <span className={styles.sepLine} />
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Bottom ruled line */}
      <span className={styles.ruleBottom} />

    </section>
  )
}