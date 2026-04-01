import Link from "next/link"
import type { ReactNode } from "react"
import StatusBadge from "@/components/admin/StatusBadge"
import { getButtonClassName } from "@/components/ui/Button/Button"
import styles from "./BookingWorkspaceHeader.module.css"

type WorkspaceAction = {
  label: string
  href?: string
  onClick?: () => void
  tone?: "primary" | "secondary" | "ghost" | "danger"
}

type WorkspaceMetaItem = {
  label: string
  value: string
}

type BookingWorkspaceHeaderProps = {
  actions?: WorkspaceAction[]
  description: string
  eyebrow?: string
  metaItems: WorkspaceMetaItem[]
  status?: string
  title: string
  supplementary?: ReactNode
}

export default function BookingWorkspaceHeader({
  actions,
  description,
  eyebrow = "Booking workspace",
  metaItems,
  status,
  supplementary,
  title,
}: BookingWorkspaceHeaderProps) {
  return (
    <section className={styles.root}>
      <div className={styles.headerRow}>
        <div className={styles.copyBlock}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            {status ? <StatusBadge value={status} /> : null}
          </div>
          <p className={styles.description}>{description}</p>
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
      </div>

      <div className={styles.metaGrid}>
        {metaItems.map((item) => (
          <div key={item.label} className={styles.metaCard}>
            <p className={styles.metaLabel}>{item.label}</p>
            <p className={styles.metaValue}>{item.value}</p>
          </div>
        ))}
      </div>

      {supplementary ? <div className={styles.supplementary}>{supplementary}</div> : null}
    </section>
  )
}
