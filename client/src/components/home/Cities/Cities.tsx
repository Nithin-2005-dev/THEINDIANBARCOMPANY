"use client"

import styles from "./Cities.module.css"
import { cities } from "@/data/cities"

export default function Cities() {
  const extended = [...cities, ...cities]

  return (
    <section className={styles.section}>

      {/* Ambient bloom */}
      <div className={styles.bloom} />

      {/* Header */}
      <div className={styles.header}>
        <span className={styles.kickerLine} />
        <span className={styles.kicker}>Explore Cities</span>
        <span className={styles.kickerLine} />
      </div>

      {/* Track */}
      <div className={styles.wrapper}>

        <div className={styles.track}>
          {extended.map((city, i) => (
            <div key={i} className={styles.pill}>
              <span className={styles.pillDot} />
              <span className={styles.pillLabel}>{city}</span>
            </div>
          ))}
        </div>

      </div>

    </section>
  )
}