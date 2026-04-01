import { useId } from "react"
import type { InputHTMLAttributes, ReactNode } from "react"
import styles from "./Input.module.css"

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  className?: string
  error?: string
  hint?: string
  inputClassName?: string
  label?: string
  leadingAdornment?: ReactNode
}

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

export default function Input({
  className,
  error,
  hint,
  id,
  inputClassName,
  label,
  leadingAdornment,
  ...props
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <label htmlFor={inputId} className={joinClasses(styles.field, className)}>
      {label || hint || error ? (
        <span className={styles.header}>
          {label ? <span className={styles.label}>{label}</span> : <span />}
          {error ? <span className={styles.error}>{error}</span> : hint ? <span className={styles.hint}>{hint}</span> : null}
        </span>
      ) : null}
      <span className={joinClasses(styles.control, error && styles.controlInvalid)}>
        {leadingAdornment ? <span className={styles.leading}>{leadingAdornment}</span> : null}
        <input id={inputId} className={joinClasses(styles.input, inputClassName)} {...props} />
      </span>
    </label>
  )
}
