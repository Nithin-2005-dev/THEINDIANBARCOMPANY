import type { BookingFlowValues } from "@/components/booking/booking-flow"
import {
  formatCurrencyRange,
  formatDisplayDate,
} from "@/components/booking/booking-flow"
import type { BookingServiceConfig } from "@/components/booking/booking-service-config"
import styles from "./StepReview.module.css"

type StepReviewProps = {
  service: BookingServiceConfig | null
  values: BookingFlowValues
}

export default function StepReview({ service, values }: StepReviewProps) {
  const rows = [
    {
      label: "Service",
      value: service?.label ?? "Custom event request",
    },
    {
      label: "Date and time",
      value: formatDisplayDate(values.eventDate),
    },
    {
      label: "Location",
      value: values.location.trim() || "Not shared yet",
    },
    {
      label: "Guests",
      value: values.guestCount ? `${values.guestCount} guests` : "Not shared yet",
    },
    {
      label: "Preferred setup",
      value:
        values.packageName.trim() ||
        values.packageLabel.trim() ||
        values.packageGuests.trim() ||
        "Not shared yet",
    },
    {
      label: "Budget",
      value: formatCurrencyRange(values.budgetMin, values.budgetMax),
    },
    {
      label: "Contact",
      value: [values.name.trim(), values.phone.trim(), values.email.trim()]
        .filter(Boolean)
        .join(" | ") || "Not shared yet",
    },
  ]

  return (
    <section className={styles.root} aria-labelledby="booking-review-heading">
      <div className={styles.header}>
        <p className={styles.eyebrow}>Step 4</p>
        <h2 id="booking-review-heading" className={styles.title}>
          You are one step from your tailored event plan.
        </h2>
        <p className={styles.description}>
          Check the brief once more and our concierge team will review it, confirm availability, and follow up on your preferred channel.
        </p>
      </div>

      <div className={styles.grid}>
        {rows.map((row) => (
          <div key={row.label} className={styles.row}>
            <p className={styles.label}>{row.label}</p>
            <p className={styles.value}>{row.value}</p>
          </div>
        ))}
      </div>

      <div className={styles.note}>
        <p className={styles.noteTitle}>Before you send</p>
        <ul className={styles.list}>
          <li>Every request is reviewed by our concierge team before availability is confirmed.</li>
          <li>No payment is required today to submit your brief.</li>
          <li>Your information stays private and is only used to prepare your quote.</li>
        </ul>
      </div>

      {values.notes.trim() ? (
        <div className={styles.notesCard}>
          <p className={styles.label}>Additional notes</p>
          <p className={styles.notes}>{values.notes.trim()}</p>
        </div>
      ) : null}
    </section>
  )
}
