"use client"

import styles from "./FinalCTA.module.css"

export default function FinalCTA() {
  return (
    <section id="final-cta" className={styles.section}>

      {/* Ambient layers */}
      <div className={styles.bloomTop}    />
      <div className={styles.bloomBottom} />
      <div className={styles.grain}       />

      {/* Ruled lines */}
      <span className={styles.ruleLeft}  />
      <span className={styles.ruleRight} />

      <div className={styles.container}>

        {/* Kicker */}
        <span className={styles.kicker}>
          <span className={styles.kickerLine} />
          Let's Create Something
          <span className={styles.kickerLine} />
        </span>

        {/* Title */}
        <h2 className={styles.title}>
          Ready to Host an<br />
          <em className={styles.titleEm}>Unforgettable</em> Experience?
        </h2>

        {/* Rule separator */}
        <div className={styles.ruleSep}>
          <span className={styles.ruleH} />
          <span className={styles.ruleDot} />
          <span className={styles.ruleH} />
        </div>

        {/* Subtitle */}
        <p className={styles.subtitle}>
          Tell us your date, location, and vision —
          we'll design a premium cocktail experience
          tailored just for you.
        </p>

        {/* Actions */}
        <div className={styles.actions}>

          <button className={styles.primary}>
            <span className={styles.btnInner}>
              Check Availability
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={styles.btnArrow}>
                <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className={styles.btnShine} />
          </button>

          <button className={styles.secondary}>
            <span className={styles.btnInner}>
              Talk to an Expert
            </span>
          </button>

        </div>

        {/* Meta */}
        <div className={styles.meta}>
          <span className={styles.metaDot} />
          No obligation
          <span className={styles.metaSep} />
          Quick response
          <span className={styles.metaSep} />
          Fully customized
          <span className={styles.metaDot} />
        </div>

      </div>

    </section>
  )
}
