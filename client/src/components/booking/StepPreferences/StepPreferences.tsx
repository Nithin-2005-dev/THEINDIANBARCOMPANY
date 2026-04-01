import type { BookingServiceConfig } from "@/components/booking/booking-service-config"
import { getRecommendedPackage } from "@/components/booking/booking-experience"
import styles from "./StepPreferences.module.css"

type StepPreferencesProps = {
  errors: Record<string, string | undefined>
  onBlur: (field: "budgetMin" | "budgetMax") => void
  onChange: (
    field: "budgetMin" | "budgetMax" | "packageLabel" | "notes",
    value: string,
  ) => void
  service: BookingServiceConfig | null
  values: {
    budgetMax: string
    budgetMin: string
    guestCount: string
    notes: string
    packageGuests: string
    packageLabel: string
    packageName: string
    packagePrice: string
  }
}

export default function StepPreferences({
  errors,
  onBlur,
  onChange,
  service,
  values,
}: StepPreferencesProps) {
  const hasPackageReference = Boolean(
    values.packageName || values.packageGuests || values.packagePrice,
  )
  const recommendation = hasPackageReference
    ? null
    : getRecommendedPackage(service, values.guestCount)

  return (
    <section className={styles.root} aria-labelledby="booking-preferences-heading">
      <div className={styles.header}>
        <p className={styles.eyebrow}>Step 3</p>
        <h2 id="booking-preferences-heading" className={styles.title}>
          Shape the service
        </h2>
        <p className={styles.description}>
          Share the atmosphere, budget, and bar direction you want us to design around.
        </p>
      </div>

      {service ? (
        <div className={styles.serviceCard}>
          <span className={styles.serviceLabel}>Selected experience</span>
          <strong className={styles.serviceValue}>{service.label}</strong>
          <p className={styles.serviceCopy}>{service.description}</p>
        </div>
      ) : null}

      {hasPackageReference ? (
        <div className={styles.packageCard}>
          <span className={styles.serviceLabel}>Starting point</span>
          <strong className={styles.serviceValue}>{values.packageName}</strong>
          <p className={styles.serviceCopy}>
            {[values.packageGuests, values.packagePrice].filter(Boolean).join(" | ")}
          </p>
        </div>
      ) : null}

      {recommendation ? (
        <div className={styles.recommendationCard}>
          <div className={styles.recommendationCopy}>
            <span className={styles.serviceLabel}>Recommended starting point</span>
            <strong className={styles.serviceValue}>{recommendation.name}</strong>
            <p className={styles.serviceCopy}>
              {recommendation.guestLabel} . {recommendation.fit}
            </p>
          </div>

          <div className={styles.recommendationMeta}>
            <span className={styles.recommendationBadge}>
              {recommendation.badge ?? "Suggested for your guest count"}
            </span>
            <span className={styles.recommendationPrice}>{recommendation.fromPrice}</span>
            <button
              type="button"
              className={styles.recommendationButton}
              suppressHydrationWarning
              onClick={() => onChange("packageLabel", recommendation.name)}
            >
              {values.packageLabel === recommendation.name
                ? "Selected as your starting point"
                : "Use this as my starting point"}
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>What setup feels right?</span>
          <input
            className={styles.input}
            data-field="packageLabel"
            name="packageLabel"
            placeholder="Signature service, elevated bar, custom menu..."
            suppressHydrationWarning
            value={values.packageLabel}
            onChange={(event) => onChange("packageLabel", event.target.value)}
          />
          <span className={styles.hint}>
            This can be a package name, a mood, or the style of bar experience you want.
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Where should we start budget-wise?</span>
          <input
            className={`${styles.input} ${errors.budgetMin ? styles.inputError : ""}`}
            data-field="budgetMin"
            inputMode="numeric"
            name="budgetMin"
            placeholder="25,000"
            suppressHydrationWarning
            value={values.budgetMin}
            onBlur={() => onBlur("budgetMin")}
            onChange={(event) => onChange("budgetMin", event.target.value)}
          />
          <span className={`${styles.hint} ${errors.budgetMin ? styles.error : ""}`}>
            {errors.budgetMin ?? "Share the lower end of your comfort range and we will work from there."}
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>What is the upper comfort range?</span>
          <input
            className={`${styles.input} ${errors.budgetMax ? styles.inputError : ""}`}
            data-field="budgetMax"
            inputMode="numeric"
            name="budgetMax"
            placeholder="50,000"
            suppressHydrationWarning
            value={values.budgetMax}
            onBlur={() => onBlur("budgetMax")}
            onChange={(event) => onChange("budgetMax", event.target.value)}
          />
          <span className={`${styles.hint} ${errors.budgetMax ? styles.error : ""}`}>
            {errors.budgetMax ?? "A ceiling helps us recommend the right service format without overshooting."}
          </span>
        </label>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>What would make this feel truly memorable?</span>
        <textarea
          className={styles.textarea}
          data-field="notes"
          name="notes"
          placeholder="Tell us about timing, cocktails, mocktails, venue restrictions, VIP guests, or anything your guests should remember."
          rows={6}
          suppressHydrationWarning
          value={values.notes}
          onChange={(event) => onChange("notes", event.target.value)}
        />
        <span className={styles.hint}>
          Mention bar style, signature drinks, venue restrictions, or a mood reference and we will build around it.
        </span>
      </label>
    </section>
  )
}
