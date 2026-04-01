import type { HTMLAttributes, ReactNode } from "react"
import styles from "./EmptyState.module.css"

type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  action?: ReactNode
  align?: "left" | "center"
  className?: string
  description: string
  eyebrow?: string
  icon?: ReactNode
  title: string
  tone?: "default" | "danger"
}

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

function EmptyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7.5h16M7 4.5h10M6.5 10.5h11l-.8 8.1a2 2 0 0 1-2 1.8H9.3a2 2 0 0 1-2-1.8l-.8-8.1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function EmptyState({
  action,
  align = "left",
  className,
  description,
  eyebrow = "Nothing here yet",
  icon,
  title,
  tone = "default",
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={joinClasses(
        styles.root,
        align === "center" && styles.centered,
        tone === "danger" && styles.danger,
        className,
      )}
      {...props}
    >
      <div className={styles.icon}>{icon ?? <EmptyIcon />}</div>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  )
}
