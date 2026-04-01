"use client"

import Link from "next/link"
import { buildBookingHref } from "@/components/booking/booking-service-config"
import styles from "./FinalCTA.module.css"

type FinalCTAProps = {
  serviceLabel?: string
  serviceSlug?: string
}

export default function FinalCTA({
  serviceLabel = "Private Event",
  serviceSlug,
}: FinalCTAProps) {
  const bookingHref = buildBookingHref({
    service: serviceSlug,
    selection: {
      serviceLabel,
    },
  })

  return (
    <section id="final-cta" className={styles.section}>
      <div className={styles.bloomTop} />
      <div className={styles.bloomBottom} />
      <div className={styles.grain} />

      <span className={styles.ruleLeft} />
      <span className={styles.ruleRight} />

      <div className={styles.container}>
        <span className={styles.kicker}>
          <span className={styles.kickerLine} />
          Concierge Booking
          <span className={styles.kickerLine} />
        </span>

        <h2 className={styles.title}>
          Ready to plan your
          <br />
          <em className={styles.titleEm}>{serviceLabel}</em>?
        </h2>

        <div className={styles.ruleSep}>
          <span className={styles.ruleH} />
          <span className={styles.ruleDot} />
          <span className={styles.ruleH} />
        </div>

        <p className={styles.subtitle}>
          Move into our dedicated booking flow to share your date, location, guest
          count, and service preferences in one focused place.
        </p>

        <div className={styles.actions}>
          <Link href={bookingHref} className={styles.primary}>
            <span className={styles.btnInner}>
              Check Availability
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className={styles.btnArrow}
              >
                <path
                  d="M1 7h12M8 2l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className={styles.btnShine} />
          </Link>

          <Link href={bookingHref} className={styles.secondary}>
            <span className={styles.btnInner}>Talk to an Expert</span>
          </Link>
        </div>

        <div className={styles.meta}>
          <span className={styles.metaDot} />
          Takes about 2 minutes
          <span className={styles.metaSep} />
          No obligation
          <span className={styles.metaSep} />
          Secure booking request
          <span className={styles.metaDot} />
        </div>
      </div>
    </section>
  )
}
