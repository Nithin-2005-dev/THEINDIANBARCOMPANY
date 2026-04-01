import type { ButtonHTMLAttributes, ReactNode } from "react"
import styles from "./Button.module.css"

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
export type ButtonSize = "sm" | "md" | "lg"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  className?: string
  loading?: boolean
  block?: boolean
  size?: ButtonSize
  variant?: ButtonVariant
}

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

export function getButtonClassName({
  block = false,
  className,
  loading = false,
  size = "md",
  variant = "primary",
}: {
  block?: boolean
  className?: string
  loading?: boolean
  size?: ButtonSize
  variant?: ButtonVariant
}) {
  return joinClasses(
    styles.root,
    styles[variant],
    size === "sm" && styles.sizeSm,
    size === "lg" && styles.sizeLg,
    block && styles.block,
    loading && styles.loading,
    className,
  )
}

export default function Button({
  children,
  className,
  loading = false,
  block = false,
  size = "md",
  type = "button",
  variant = "primary",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={getButtonClassName({ block, className, loading, size, variant })}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  )
}
