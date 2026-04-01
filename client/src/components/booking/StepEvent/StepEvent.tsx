import styles from "./StepEvent.module.css"

type StepEventProps = {
  errors: Record<string, string | undefined>
  onBlur: (field: "eventType" | "location" | "eventDate" | "guestCount") => void
  onChange: (field: "eventType" | "location" | "eventDate" | "guestCount", value: string) => void
  values: {
    eventDate: string
    eventType: string
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
          What are you planning?
        </h2>
        <p className={styles.description}>
          Share the essentials and we will size the bar, staffing, and flow around your event.
        </p>
      </div>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>What kind of event is this?</span>
          <input
            className={`${styles.input} ${errors.eventType ? styles.inputError : ""}`}
            data-field="eventType"
            name="eventType"
            placeholder="House party, launch night, sundowner..."
            suppressHydrationWarning
            value={values.eventType}
            onBlur={() => onBlur("eventType")}
            onChange={(event) => onChange("eventType", event.target.value)}
          />
          <span className={`${styles.hint} ${errors.eventType ? styles.error : ""}`}>
            {errors.eventType ?? "A simple description is enough. We can refine the brief with you later."}
          </span>
        </label>

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
