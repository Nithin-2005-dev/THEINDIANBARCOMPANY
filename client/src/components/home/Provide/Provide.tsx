"use client"

import styles from "./Provide.module.css"
import { provide } from "@/data/provide"

export default function Provide() {
  return (
    <section className={styles.section}>

      {/* Ambient bloom */}
      <div className={styles.bloom} />

      {/* HEADER */}
      <div className={styles.header}>
        <span className={styles.kicker}>
          <span className={styles.kickerLine} />
          What We Provide
          <span className={styles.kickerLine} />
        </span>
        <h2 className={styles.title}>
          Everything You Need For
          <br />
          <em className={styles.titleEm}>A Perfect Celebration</em>
        </h2>
        <div className={styles.ruleSep}>
          <span className={styles.ruleH} />
          <span className={styles.ruleDot} />
          <span className={styles.ruleH} />
        </div>
      </div>

      {/* GRID */}
      <div className={styles.grid}>
        {provide.map((item, i) => (
          <div key={i} className={styles.card}>

            {/* Glow */}
            <div className={styles.cardGlow} />

            {/* Number */}
            <span className={styles.number}>
              {(i + 1).toString().padStart(2, "0")}
            </span>

            {/* Divider */}
            <span className={styles.divider} />

            {/* Title */}
            <h3 className={styles.cardTitle}>{item.title}</h3>

            {/* Desc */}
            <p className={styles.desc}>{item.desc}</p>

            {/* Accent line */}
            <span className={styles.accent} />

          </div>
        ))}
      </div>

    </section>
  )
}