import styles from "./StepEvent.module.css"

type StepEventProps = {
  errors: Record<string, string | undefined>
  onBlur: (field: "location" | "eventDate" | "guestCount") => void
  onChange: (field: "location" | "eventDate" | "guestCount", value: string) => void
  values: {
    eventDate: string
    guestCount: string
    location: string
  }
}

export default function StepEvent({
  errors,
  onBlur,
  onChange,
  values,
}: StepEventProps) {
  return (
    <section className={styles.root} aria-labelledby="booking-event-heading">
      <div className={styles.header}>
        <p className={styles.eyebrow}>Step 2</p>
        <h2 id="booking-event-heading" className={styles.title}>
          Lock the event essentials
        </h2>
        <p className={styles.description}>
          Your selected service already defines the service lane. Now we just need the date, venue, and guest count.
        </p>
      </div>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Where is it happening?</span>
          <input
            className={`${styles.input} ${errors.location ? styles.inputError : ""}`}
            data-field="location"
            name="location"
            placeholder="Delhi, Mumbai, venue name..."
            suppressHydrationWarning
            value={values.location}
            onBlur={() => onBlur("location")}
            onChange={(event) => onChange("location", event.target.value)}
          />
          <span className={`${styles.hint} ${errors.location ? styles.error : ""}`}>
            {errors.location ?? "City, venue, or neighborhood is perfect for this stage."}
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>When should we hold the date?</span>
          <input
            className={`${styles.input} ${errors.eventDate ? styles.inputError : ""}`}
            data-field="eventDate"
            name="eventDate"
            suppressHydrationWarning
            type="datetime-local"
            value={values.eventDate}
            onBlur={() => onBlur("eventDate")}
            onChange={(event) => onChange("eventDate", event.target.value)}
          />
          <span className={`${styles.hint} ${errors.eventDate ? styles.error : ""}`}>
            {errors.eventDate ?? "Choose the expected start time. An informed estimate is absolutely fine."}
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>How many guests should we plan for?</span>
          <input
            className={`${styles.input} ${errors.guestCount ? styles.inputError : ""}`}
            data-field="guestCount"
            inputMode="numeric"
            name="guestCount"
            placeholder="80"
            suppressHydrationWarning
            value={values.guestCount}
            onBlur={() => onBlur("guestCount")}
            onChange={(event) =>
              onChange("guestCount", event.target.value.replace(/[^\d]/g, ""))
            }
          />
          <span className={`${styles.hint} ${errors.guestCount ? styles.error : ""}`}>
            {errors.guestCount ?? "This helps us recommend staffing, setup size, and the right package lane."}
          </span>
        </label>
      </div>
    </section>
  )
}
