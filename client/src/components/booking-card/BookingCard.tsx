import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"
import StatusBadge from "@/components/admin/StatusBadge"
import { getButtonClassName } from "@/components/ui/Button/Button"
import styles from "./BookingCard.module.css"

type BookingCardTone = "default" | "accent" | "success" | "warning" | "danger"

type BookingCardMetric = {
  label: string
  value: string
  tone?: BookingCardTone
}

type BookingCardAction = {
  label: string
  href?: string
  onClick?: () => void
  tone?: "primary" | "secondary" | "ghost" | "danger"
}

type BookingCardProps = {
  actions?: BookingCardAction[]
  className?: string
  footer?: ReactNode
  meta?: string
  metrics: BookingCardMetric[]
  progress?: number
  progressLabel?: string
  status?: string
  style?: CSSProperties
  subtitle?: string
  title: string
}

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

function getMetricToneClass(tone?: BookingCardTone) {
  if (tone === "accent") return styles.metricAccent
  if (tone === "success") return styles.metricSuccess
  if (tone === "warning") return styles.metricWarning
  if (tone === "danger") return styles.metricDanger
  return undefined
}

export default function BookingCard({
  actions,
  className,
  footer,
  meta,
  metrics,
  progress,
  progressLabel = "Progress",
  status,
  style,
  subtitle,
  title,
}: BookingCardProps) {
  return (
    <article className={joinClasses(styles.root, className)} style={style}>
      <div className={styles.header}>
        <div className={styles.headerBody}>
          <h3 className={styles.title}>{title}</h3>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          {meta ? <p className={styles.meta}>{meta}</p> : null}
        </div>
        {status ? <StatusBadge value={status} /> : null}
      </div>

      {typeof progress === "number" ? (
        <div className={styles.progressBlock}>
          <div className={styles.progressHeader}>
            <span>{progressLabel}</span>
            <span>{progress}%</span>
          </div>
          <progress className={styles.progressBar} value={progress} max={100} />
        </div>
      ) : null}

      <div className={styles.metricsGrid}>
        {metrics.map((metric) => (
          <div
            key={`${metric.label}:${metric.value}`}
            className={joinClasses(styles.metricCard, getMetricToneClass(metric.tone))}
          >
            <p className={styles.metricLabel}>{metric.label}</p>
            <p className={styles.metricValue}>{metric.value}</p>
          </div>
        ))}
      </div>

      {actions?.length ? (
        <div className={styles.actions}>
          {actions.map((action) =>
            action.href ? (
              <Link
                key={`${action.label}:${action.href}`}
                href={action.href}
                className={getButtonClassName({
                  className: styles.actionButton,
                  variant: action.tone ?? "secondary",
                })}
              >
                {action.label}
              </Link>
            ) : (
              <button
                key={action.label}
                type="button"
                className={getButtonClassName({
                  className: styles.actionButton,
                  variant: action.tone ?? "secondary",
                })}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ),
          )}
        </div>
      ) : null}

      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </article>
  )
}
