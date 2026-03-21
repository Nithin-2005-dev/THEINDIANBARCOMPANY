"use client"

import styles from "./Addons.module.css"

type Addon = {
  title: string
  desc: string
}

type AddonsProps = {
  title: string
  subtitle: string
  addons: Addon[]
}

export default function Addons({ title, subtitle, addons }: AddonsProps) {
  return (
    <section className={styles.section}>

      {/* Ambient bloom */}
      <div className={styles.bloom} />

      {/* HEADER */}
      <div className={styles.header}>
        <span className={styles.kicker}>
          <span className={styles.kickerLine} />
          Add-ons
          <span className={styles.kickerLine} />
        </span>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>

      {/* GRID */}
      <div className={styles.grid}>
        {addons.map((a, i) => (
          <div key={i} className={styles.card}>

            {/* Top gradient */}
            <div className={styles.cardGlow} />

            {/* Index */}
            <span className={styles.index}>
              {String(i + 1).padStart(2, "0")}
            </span>

            {/* Divider */}
            <span className={styles.divider} />

            {/* Title */}
            <h3 className={styles.cardTitle}>{a.title}</h3>

            {/* Desc */}
            <p className={styles.desc}>{a.desc}</p>

            {/* Bottom accent line */}
            <span className={styles.accent} />

          </div>
        ))}
      </div>

    </section>
  )
}