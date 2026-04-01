"use client"

import { useEffect, useId, useRef } from "react"
import type { ReactNode, RefObject } from "react"
import styles from "./Modal.module.css"

type ModalSize = "sm" | "md" | "lg" | "xl"

type ModalProps = {
  children: ReactNode
  closeDisabled?: boolean
  closeLabel?: string
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  description?: string
  footer?: ReactNode
  initialFocusRef?: RefObject<HTMLElement | null>
  onClose: () => void
  open: boolean
  panelClassName?: string
  size?: ModalSize
  title: string
  tone?: "default" | "danger"
}

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return []

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        "a[href]",
        "button:not([disabled])",
        "textarea:not([disabled])",
        "input:not([disabled]):not([type='hidden'])",
        "select:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(","),
    ),
  ).filter((element) => !element.hasAttribute("disabled") && element.tabIndex !== -1)
}

export default function Modal({
  children,
  closeDisabled = false,
  closeLabel = "Close",
  closeOnBackdrop = true,
  closeOnEscape = true,
  description,
  footer,
  initialFocusRef,
  onClose,
  open,
  panelClassName,
  size = "md",
  title,
  tone = "default",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const focusTarget = () => {
      const focusable = getFocusableElements(panelRef.current)
      const target = initialFocusRef?.current ?? focusable[0] ?? panelRef.current
      target?.focus()
    }

    const timerId = window.setTimeout(focusTarget, 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeOnEscape && !closeDisabled) {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== "Tab") return

      const focusable = getFocusableElements(panelRef.current)
      if (!focusable.length) {
        event.preventDefault()
        panelRef.current?.focus()
        return
      }

      const firstElement = focusable[0]
      const lastElement = focusable[focusable.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.clearTimeout(timerId)
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
      previouslyFocusedRef.current?.focus()
    }
  }, [closeDisabled, closeOnEscape, initialFocusRef, onClose, open])

  if (!open) return null

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && closeOnBackdrop && !closeDisabled) {
          onClose()
        }
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={joinClasses(
          styles.panel,
          size === "sm" && styles.sizeSm,
          size === "md" && styles.sizeMd,
          size === "lg" && styles.sizeLg,
          size === "xl" && styles.sizeXl,
          tone === "danger" && styles.danger,
          panelClassName,
        )}
      >
        <div className={styles.header}>
          <div>
            <p className={joinClasses(styles.eyebrow, tone === "danger" && styles.eyebrowDanger)}>
              {tone === "danger" ? "Critical action" : "Dialog"}
            </p>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className={styles.closeButton}
          >
            {closeLabel}
          </button>
        </div>

        <div className={styles.content}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  )
}
