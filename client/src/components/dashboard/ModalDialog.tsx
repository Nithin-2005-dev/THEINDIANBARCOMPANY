"use client"

import { useState } from "react"
import { DashboardButton } from "@/components/dashboard/DashboardPrimitives"
import Modal from "@/components/ui/Modal/Modal"
import styles from "@/components/dashboard/ModalDialog.module.css"

function joinClasses(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ")
}

function getModalSize(widthClassName: string) {
  if (widthClassName.includes("max-w-xl")) return "sm" as const
  if (widthClassName.includes("max-w-3xl")) return "md" as const
  if (widthClassName.includes("max-w-6xl")) return "xl" as const
  return "lg" as const
}

type ModalDialogProps = {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  widthClassName?: string
  tone?: "default" | "danger"
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  closeDisabled?: boolean
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

export function ModalDialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  widthClassName = "max-w-3xl",
  tone = "default",
  closeOnBackdrop = true,
  closeOnEscape = true,
  closeDisabled = false,
  initialFocusRef,
}: ModalDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      tone={tone}
      closeOnBackdrop={closeOnBackdrop}
      closeOnEscape={closeOnEscape}
      closeDisabled={closeDisabled}
      initialFocusRef={initialFocusRef}
      size={getModalSize(widthClassName)}
      footer={footer}
    >
      {children}
    </Modal>
  )
}

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  confirmTone?: "primary" | "secondary" | "danger"
  tone?: "default" | "danger"
  bullets?: string[]
  acknowledgementLabel?: string
  requireAcknowledgement?: boolean
  isPending?: boolean
  onConfirm: () => void | Promise<void>
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmTone = "primary",
  tone = "default",
  bullets,
  acknowledgementLabel,
  requireAcknowledgement = false,
  isPending,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false)

  const confirmDisabled = Boolean(
    isPending || (requireAcknowledgement && !acknowledged),
  )

  const handleClose = () => {
    setAcknowledged(false)
    onClose()
  }

  const handleConfirm = async () => {
    await onConfirm()
    setAcknowledged(false)
  }

  return (
    <ModalDialog
      open={open}
      onClose={handleClose}
      title={title}
      description={description}
      tone={tone}
      closeDisabled={Boolean(isPending)}
      widthClassName="max-w-xl"
      footer={
        <>
          <DashboardButton tone="secondary" onClick={handleClose} disabled={isPending}>
            {cancelLabel}
          </DashboardButton>
          <DashboardButton
            tone={confirmTone}
            onClick={() => void handleConfirm()}
            disabled={confirmDisabled}
          >
            {isPending ? "Working..." : confirmLabel}
          </DashboardButton>
        </>
      }
    >
      <div
        className={joinClasses(styles.callout, tone === "danger" && styles.calloutDanger)}
      >
        {tone === "danger"
          ? "This affects the live workflow and should be used deliberately."
          : "Review the action carefully before continuing. This change will be recorded in the operational workflow."}
      </div>

      {bullets?.length ? (
        <div className={styles.bulletList}>
          {bullets.map((bullet) => (
            <div key={bullet} className={styles.bulletItem}>{bullet}</div>
          ))}
        </div>
      ) : null}

      {requireAcknowledgement && acknowledgementLabel ? (
        <label className={styles.acknowledgement}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>{acknowledgementLabel}</span>
        </label>
      ) : null}
    </ModalDialog>
  )
}
