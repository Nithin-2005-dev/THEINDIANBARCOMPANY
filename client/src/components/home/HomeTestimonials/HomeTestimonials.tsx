"use client"

import styles from "./HomeTestimonials.module.css"

const testimonials = [
  {
    quote: "One of the most premium event experiences we've ever had. Everything was seamless.",
    name: "Rohan Mehta",
    event: "Private Celebration",
  },
  {
    quote: "Felt like a five-star lounge inside our home. Guests were blown away.",
    name: "Ananya Kapoor",
    event: "House Party",
  },
  {
    quote: "Professional team, world-class cocktails, and flawless execution.",
    name: "Vikram Shah",
    event: "Corporate Event",
  },
  {
    quote: "Exceptional service from start to finish. Truly unforgettable.",
    name: "Neha Sharma",
    event: "Wedding After Party",
  },
]

export default function HomeTestimonials() {
  return (
    <section className={styles.section}>

      {/* Bloom */}
      <div className={styles.bloom} />

      {/* HEADER */}
      <div className={styles.header}>
        <span className={styles.kicker}>
          <span className={styles.kickerLine} />
          Testimonials
          <span className={styles.kickerLine} />
        </span>
        <h2 className={styles.title}>
          Trusted by Hosts <em className={styles.titleEm}>Across India</em>
        </h2>
        <div className={styles.ruleSep}>
          <span className={styles.ruleH} />
          <span className={styles.ruleDot} />
          <span className={styles.ruleH} />
        </div>
        <p className={styles.subtitle}>Real experiences from our clients</p>
      </div>

      {/* SCROLL AREA */}
      <div className={styles.wrapper}>
        <div className={styles.track}>
          {testimonials.map((t, i) => (
            <div key={i} className={styles.card}>

              {/* Glow */}
              <div className={styles.cardGlow} />

              {/* Quote mark */}
              <span className={styles.quoteMark}>"</span>

              {/* Quote */}
              <p className={styles.quote}>{t.quote}</p>

              {/* Divider */}
              <span className={styles.divider} />

              {/* Client */}
              <div className={styles.client}>
                <div className={styles.avatar}>
                  {t.name.split(" ").map(w => w[0]).join("")}
                </div>
                <div className={styles.clientInfo}>
                  <span className={styles.name}>{t.name}</span>
                  <span className={styles.event}>{t.event}</span>
                </div>
              </div>

              {/* Accent line */}
              <span className={styles.accent} />

            </div>
          ))}
        </div>
      </div>

      {/* Scroll hint */}
      <div className={styles.scrollHint}>
        <span className={styles.scrollLine} />
        <span className={styles.scrollText}>Scroll to explore</span>
        <span className={styles.scrollLine} />
      </div>

    </section>
  )
}