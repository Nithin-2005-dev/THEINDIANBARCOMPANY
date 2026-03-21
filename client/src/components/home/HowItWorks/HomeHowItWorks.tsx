"use client"

import styles from "./HomeHowItWorks.module.css"

const steps = [
  {
    title: "Tell Us Your Plan",
    desc: "Share your event details, preferences, and location.",
  },
  {
    title: "We Design The Experience",
    desc: "Our team crafts a tailored concept with drinks, setup, and staffing.",
  },
  {
    title: "Professional Setup",
    desc: "We arrive early to prepare everything before guests arrive.",
  },
  {
    title: "Enjoy Stress-Free",
    desc: "Relax and celebrate while we handle everything end-to-end.",
  },
]

export default function HomeHowItWorks() {
  return (
    <section className={styles.section}>

      {/* Bloom */}
      <div className={styles.bloom} />

      {/* HEADER */}
      <div className={styles.header}>
        <span className={styles.kicker}>
          <span className={styles.kickerLine} />
          The Process
          <span className={styles.kickerLine} />
        </span>
        <h2 className={styles.title}>
          How It <em className={styles.titleEm}>Works</em>
        </h2>
        <div className={styles.ruleSep}>
          <span className={styles.ruleH} />
          <span className={styles.ruleDot} />
          <span className={styles.ruleH} />
        </div>
        <p className={styles.subtitle}>
          A seamless experience from planning to celebration.
        </p>
      </div>

      {/* TIMELINE */}
      <div className={styles.timeline}>

        {/* Vertical spine */}
        <div className={styles.spine} />

        {steps.map((step, i) => (
          <div key={i} className={styles.step}>

            {/* Node */}
            <div className={styles.nodeWrap}>
              <div className={styles.nodeRing} />
              <div className={styles.node}>
                <span className={styles.nodeNum}>
                  {(i + 1).toString().padStart(2, "0")}
                </span>
              </div>
            </div>

            {/* Card */}
            <div className={styles.card}>
              <div className={styles.cardGlow} />
              <span className={styles.cardIndex}>Step {(i + 1).toString().padStart(2, "0")}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.desc}>{step.desc}</p>
              <span className={styles.cardAccent} />
            </div>

          </div>
        ))}

      </div>

    </section>
  )
}