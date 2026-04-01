import styles from "./StepContact.module.css"

type StepContactProps = {
  errors: Record<string, string | undefined>
  onBlur: (field: "name" | "phone" | "email" | "preferredContact") => void
  onChange: (field: "name" | "phone" | "email" | "preferredContact", value: string) => void
  values: {
    email: string
    name: string
    phone: string
    preferredContact: string
  }
}

const preferredContactOptions = [
  { label: "Call", value: "call" },
  { label: "WhatsApp", note: "Recommended", value: "whatsapp" },
  { label: "Email", value: "email" },
]

export default function StepContact({
  errors,
  onBlur,
  onChange,
  values,
}: StepContactProps) {
  return (
    <section className={styles.root} aria-labelledby="booking-contact-heading">
      <div className={styles.header}>
        <p className={styles.eyebrow}>Step 1</p>
        <h2 id="booking-contact-heading" className={styles.title}>
          Where should we send your plan?
        </h2>
        <p className={styles.description}>
          A few contact details and we can move like a concierge, not a call center.
        </p>
      </div>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>What should we call you?</span>
          <input
            autoComplete="name"
            className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
            data-field="name"
            name="name"
            placeholder="Your full name"
            suppressHydrationWarning
            value={values.name}
            onBlur={() => onBlur("name")}
            onChange={(event) => onChange("name", event.target.value)}
          />
          <span className={`${styles.hint} ${errors.name ? styles.error : ""}`}>
            {errors.name ?? "We use this in your proposal and when our concierge team reaches out."}
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Best number to reach you</span>
          <input
            autoComplete="tel"
            className={`${styles.input} ${errors.phone ? styles.inputError : ""}`}
            data-field="phone"
            inputMode="tel"
            name="phone"
            placeholder="+91 98765 43210"
            suppressHydrationWarning
            value={values.phone}
            onBlur={() => onBlur("phone")}
            onChange={(event) => onChange("phone", event.target.value)}
          />
          <span className={`${styles.hint} ${errors.phone ? styles.error : ""}`}>
            {errors.phone ?? "We usually confirm availability first on call or WhatsApp."}
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Where should we send your proposal?</span>
          <input
            autoComplete="email"
            className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
            data-field="email"
            name="email"
            placeholder="you@example.com"
            suppressHydrationWarning
            type="email"
            value={values.email}
            onBlur={() => onBlur("email")}
            onChange={(event) => onChange("email", event.target.value)}
          />
          <span className={`${styles.hint} ${errors.email ? styles.error : ""}`}>
            {errors.email ?? "Ideal for your written proposal, invoice trail, and event documents."}
          </span>
        </label>
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>How would you like us to reach you?</legend>
        <div className={styles.options} role="radiogroup" aria-label="Preferred contact">
          {preferredContactOptions.map((option) => {
            const isActive = values.preferredContact === option.value

            return (
              <button
                key={option.value}
                type="button"
                aria-checked={isActive}
                className={`${styles.option} ${isActive ? styles.optionActive : ""}`}
                data-field="preferredContact"
                role="radio"
                suppressHydrationWarning
                onBlur={() => onBlur("preferredContact")}
                onClick={() => onChange("preferredContact", option.value)}
              >
                <span className={styles.optionLabel}>{option.label}</span>
                {option.note ? <span className={styles.optionNote}>{option.note}</span> : null}
              </button>
            )
          })}
        </div>
        <p className={`${styles.hint} ${errors.preferredContact ? styles.error : ""}`}>
          {errors.preferredContact ?? "Choose the channel you are most likely to answer quickly."}
        </p>
      </fieldset>
    </section>
  )
}
