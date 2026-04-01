"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { BookingFlowValues } from "@/components/booking/booking-flow"
import {
  formatCurrencyRange,
  formatDisplayDate,
} from "@/components/booking/booking-flow"
import {
  getBookingExperience,
  getRecommendedPackage,
} from "@/components/booking/booking-experience"
import type { BookingServiceConfig } from "@/components/booking/booking-service-config"
import styles from "./BookingSummary.module.css"

type BookingSummaryProps = {
  service: BookingServiceConfig | null
  values: BookingFlowValues
}

type SummaryRow = {
  key: string
  kind: "budget" | "contact" | "date" | "guests" | "location" | "service"
  label: string
  value: string
}

function SummaryIcon({ kind }: { kind: SummaryRow["kind"] }) {
  if (kind === "service") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M7 5h10v2a5 5 0 0 1-10 0V5ZM9 12.5h6M8 19h8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    )
  }

  if (kind === "date") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M7 4.5v3M17 4.5v3M5 8.5h14M6.5 6h11A1.5 1.5 0 0 1 19 7.5v10A1.5 1.5 0 0 1 17.5 19h-11A1.5 1.5 0 0 1 5 17.5v-10A1.5 1.5 0 0 1 6.5 6Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    )
  }

  if (kind === "location") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M12 20s-5-4.6-5-9a5 5 0 1 1 10 0c0 4.4-5 9-5 9Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <circle cx="12" cy="11" r="1.8" fill="currentColor" />
      </svg>
    )
  }

  if (kind === "guests") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M8.5 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM15.5 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM4.5 18c.4-2.2 2.3-3.8 4.6-3.8S13.2 15.8 13.6 18M13.2 18c.3-1.7 1.7-2.9 3.4-2.9s3.1 1.2 3.4 2.9"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    )
  }

  if (kind === "budget") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M6 8.5h12M6 15.5h12M9.5 5.5l-2 13M14.5 5.5l-2 13"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M7 8.5a5 5 0 0 1 10 0c0 4-5 7.5-5 7.5S7 12.5 7 8.5ZM5.5 19.5h13"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export default function BookingSummary({
  service,
  values,
}: BookingSummaryProps) {
  const experience = getBookingExperience(service)
  const recommendation = getRecommendedPackage(service, values.guestCount)
  const [changedKeys, setChangedKeys] = useState<string[]>([])
  const previousSummaryRef = useRef<Record<string, string>>({})

  const summaryRows = useMemo<SummaryRow[]>(
    () => [
      {
        key: "service",
        kind: "service",
        label: "Service",
        value: service?.label ?? "Custom event request",
      },
      {
        key: "date",
        kind: "date",
        label: "Date",
        value: formatDisplayDate(values.eventDate),
      },
      {
        key: "location",
        kind: "location",
        label: "Location",
        value: values.location.trim() || "To be confirmed",
      },
      {
        key: "guests",
        kind: "guests",
        label: "Guests",
        value: values.guestCount ? `${values.guestCount} guests` : "Not shared yet",
      },
      {
        key: "budget",
        kind: "budget",
        label: "Budget",
        value: formatCurrencyRange(values.budgetMin, values.budgetMax),
      },
      {
        key: "contact",
        kind: "contact",
        label: "Contact",
        value:
          values.name.trim() ||
          values.phone.trim() ||
          values.email.trim() ||
          "Not shared yet",
      },
    ],
    [
      service?.label,
      values.eventDate,
      values.location,
      values.guestCount,
      values.budgetMin,
      values.budgetMax,
      values.name,
      values.phone,
      values.email,
    ],
  )

  const summaryFingerprint = summaryRows
    .map((row) => `${row.key}:${row.value}`)
    .join("|")

  useEffect(() => {
    const changed = summaryRows
      .filter((row) => {
        const previousValue = previousSummaryRef.current[row.key]
        return Boolean(previousValue) && previousValue !== row.value
      })
      .map((row) => row.key)

    previousSummaryRef.current = Object.fromEntries(
      summaryRows.map((row) => [row.key, row.value]),
    )

    if (!changed.length) return

    setChangedKeys(changed)
    const timeoutId = window.setTimeout(() => setChangedKeys([]), 720)
    return () => window.clearTimeout(timeoutId)
  }, [summaryFingerprint, summaryRows])

  const estimateValue =
    values.budgetMin || values.budgetMax
      ? formatCurrencyRange(values.budgetMin, values.budgetMax)
      : recommendation?.fromPrice ?? "Tailored quote"

  return (
    <section className={styles.root} aria-labelledby="booking-summary-title">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Concierge preview</p>
          <h2 id="booking-summary-title" className={styles.title}>
            Your event brief
          </h2>
        </div>

        <span className={styles.liveBadge}>
          <span className={styles.liveDot} aria-hidden="true" />
          Live
        </span>
      </div>

      <div className={styles.previewCard}>
        <div className={styles.previewArt} aria-hidden="true">
          <span className={styles.previewArtLabel}>{experience.moodLabel}</span>
          <strong className={styles.previewArtValue}>
            {recommendation?.name ?? service?.shortLabel ?? "Custom brief"}
          </strong>
        </div>

        <div className={styles.previewCopy}>
          <p className={styles.previewEyebrow}>
            {recommendation ? "Recommended package" : "Service mood"}
          </p>
          <h3 className={styles.previewTitle}>
            {recommendation?.name ?? experience.moodLabel}
          </h3>
          <p className={styles.previewDescription}>
            {recommendation?.fit ?? experience.moodCopy}
          </p>
          <div className={styles.previewPills}>
            <span className={styles.previewPill}>
              {recommendation?.badge ?? "Tailored concierge"}
            </span>
            <span className={styles.previewPill}>
              {recommendation?.guestLabel ?? "No payment required today"}
            </span>
          </div>
        </div>
      </div>

      <dl className={styles.grid}>
        {summaryRows.map((row) => (
          <div
            key={row.key}
            className={`${styles.row} ${changedKeys.includes(row.key) ? styles.rowChanged : ""}`}
          >
            <dt className={styles.rowMeta}>
              <span className={styles.iconWrap}>
                <SummaryIcon kind={row.kind} />
              </span>
              <span className={styles.label}>{row.label}</span>
            </dt>
            <dd className={styles.value}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.estimateCard}>
        <div className={styles.estimateCopy}>
          <p className={styles.estimateLabel}>
            {values.budgetMin || values.budgetMax
              ? "Planned investment"
              : "Recommended starting point"}
          </p>
          <strong className={styles.estimateValue}>{estimateValue}</strong>
        </div>
        <p className={styles.estimateHint}>No payment required today</p>
      </div>

      <div className={styles.reassurance}>
        <p className={styles.reassuranceTitle}>What happens next</p>
        <ul className={styles.list}>
          <li>We review your brief and confirm the best next step.</li>
          <li>Your details stay private and are only used for this request.</li>
          <li>Expect a response on your preferred channel within 30 minutes during business hours.</li>
        </ul>
      </div>
    </section>
  )
}
