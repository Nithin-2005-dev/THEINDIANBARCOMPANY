import { BOOKING_STEPS } from "@/components/booking/booking-flow"
import styles from "./ProgressBar.module.css"

type ProgressBarProps = {
  currentStep: number
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className={styles.checkIcon}
      viewBox="0 0 20 20"
    >
      <path
        d="M5 10.5 8.4 14 15 7.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

export default function ProgressBar({ currentStep }: ProgressBarProps) {
  const currentStepNumber = currentStep + 1
  const progressPercent = (currentStepNumber / BOOKING_STEPS.length) * 100

  return (
    <nav className={styles.root} aria-label="Booking progress">
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>
            Step {currentStepNumber} of {BOOKING_STEPS.length}
          </p>
          <p className={styles.heading}>A concierge brief in four measured steps</p>
          <p className={styles.support}>
            Quick to complete, private by default, and designed for premium event planning.
          </p>
        </div>

        <div className={styles.meter} aria-hidden="true">
          <span
            className={styles.meterFill}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <ol className={styles.list}>
        {BOOKING_STEPS.map((step, index) => {
          const isActive = index === currentStep
          const isComplete = index < currentStep
          const statusLabel = isComplete ? "Done" : isActive ? "Current" : null

          return (
            <li
              key={step.id}
              className={[
                styles.item,
                isActive ? styles.itemActive : "",
                isComplete ? styles.itemComplete : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span
                className={[
                  styles.marker,
                  isActive ? styles.markerActive : "",
                  isComplete ? styles.markerComplete : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={isActive ? "step" : undefined}
              >
                {isComplete ? <CheckIcon /> : String(index + 1).padStart(2, "0")}
              </span>
              <div className={styles.copy}>
                <div className={styles.titleRow}>
                  <p className={styles.title}>{step.title}</p>
                  {statusLabel ? <span className={styles.status}>{statusLabel}</span> : null}
                </div>
                <p className={styles.description}>{step.description}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
