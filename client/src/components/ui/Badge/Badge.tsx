import type { HTMLAttributes, ReactNode } from "react"
import styles from "./Badge.module.css"

export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger"
export type BadgeSize = "sm" | "md"

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
  className?: string
  size?: BadgeSize
  variant?: BadgeVariant
}

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

export default function Badge({
  children,
  className,
  size = "md",
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={joinClasses(
        styles.root,
        size === "sm" && styles.sm,
        variant === "accent" && styles.accent,
        variant === "success" && styles.success,
        variant === "warning" && styles.warning,
        variant === "danger" && styles.danger,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
