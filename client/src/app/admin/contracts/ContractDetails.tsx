"use client"

import { ConfirmDialog, ModalDialog } from "@/components/dashboard/ModalDialog"
import { EmptyState, ErrorState } from "@/components/dashboard/DashboardPrimitives"
import { formatDate } from "@/lib/admin-format"
import type { UseContractsResult } from "./contracts.types"
import styles from "./page.module.css"

type ContractDetailsProps = Pick<
  UseContractsResult,
  | "previewOpen"
  | "templatePreview"
  | "onPreviewClose"
  | "versionState"
  | "onCloseVersions"
  | "pendingStatusChange"
  | "onCancelDestructiveStatus"
  | "onConfirmDestructiveStatus"
  | "isSavingStatus"
>

function openExternalUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer")
}

export function ContractDetails({
  previewOpen,
  templatePreview,
  onPreviewClose,
  versionState,
  onCloseVersions,
  pendingStatusChange,
  onCancelDestructiveStatus,
  onConfirmDestructiveStatus,
  isSavingStatus,
}: ContractDetailsProps) {
  return (
    <>
      <ModalDialog
        open={previewOpen}
        onClose={onPreviewClose}
        title={templatePreview?.title ?? "Contract Preview"}
        description="Review the generated document before sending it to the client."
        widthClassName="max-w-6xl"
      >
        {templatePreview ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className={styles.softPill}>{templatePreview.template.name}</div>
              <div className={styles.softPill}>{templatePreview.suggestedFileName}</div>
              <div className={styles.softPill}>
                {templatePreview.template.supportsNativeSignature ? "Native signature ready" : "Manual signing"}
              </div>
              <div className={styles.softPill}>Secure storage enabled</div>
              <div className={styles.softPill}>E-sign integration ready</div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-[22px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-sm font-medium text-[var(--dashboard-text)]">Preview safeguards</p>
                <p className="mt-2 text-sm leading-7 text-[var(--dashboard-muted)]">
                  This preview uses the same generated HTML that will be stored as the current contract version. Secure access URLs and revision history are attached after generation.
                </p>
              </div>
              <div className="rounded-[22px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-sm font-medium text-[var(--dashboard-text)]">Filled template fields</p>
                <div className="mt-3 space-y-2">
                  {templatePreview.fields.map((field) => (
                    <div key={field.key} className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-[var(--dashboard-muted)]">{field.label}</span>
                      <span className="max-w-[60%] text-right text-[var(--dashboard-text)]">
                        {field.value || "Not provided"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <iframe
              title="Contract preview"
              srcDoc={templatePreview.html}
              className="h-[70vh] w-full rounded-[22px] border border-[var(--dashboard-border)] bg-white"
            />
          </div>
        ) : (
          <EmptyState
            title="Preview unavailable"
            description="Load a template preview from the form first."
          />
        )}
      </ModalDialog>

      <ModalDialog
        open={Boolean(versionState.contract)}
        onClose={onCloseVersions}
        title={versionState.contract ? `${versionState.contract.proposal?.title ?? "Contract"} versions` : "Contract versions"}
        description="Use secure links for review and keep revision history visible to operations."
        widthClassName="max-w-3xl"
      >
        {versionState.loading ? (
          <div className="space-y-3">
            <div className={`${styles.skeleton} h-20 rounded-[20px]`} />
            <div className={`${styles.skeleton} h-20 rounded-[20px]`} />
          </div>
        ) : versionState.error ? (
          <ErrorState title="Unable to load versions" description={versionState.error} />
        ) : versionState.versions.length ? (
          <div className="space-y-3">
            {versionState.versions.map((version) => (
              <div
                key={version.id}
                className="rounded-[22px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-[var(--dashboard-text)]">
                        Version {version.version}
                      </p>
                      {version.isCurrent ? <div className={styles.softPill}>Current</div> : null}
                    </div>
                    <p className="mt-2 text-sm text-[var(--dashboard-muted)]">
                      Uploaded by {version.uploadedByLabel}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--dashboard-subtle)]">
                      {formatDate(version.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openExternalUrl(version.accessUrl)}
                    className={`${styles.secondaryButton} inline-flex min-h-10 items-center rounded-full px-4 text-sm`}
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No versions recorded yet"
            description="New uploads and generated template contracts will appear here with secure access links."
          />
        )}
      </ModalDialog>

      <ConfirmDialog
        open={Boolean(pendingStatusChange)}
        onClose={onCancelDestructiveStatus}
        onConfirm={onConfirmDestructiveStatus}
        isPending={isSavingStatus}
        tone="danger"
        confirmTone="danger"
        title={
          pendingStatusChange?.nextStatus === "ARCHIVED"
            ? "Archive contract"
            : "Cancel contract"
        }
        description={
          pendingStatusChange?.nextStatus === "ARCHIVED"
            ? "Archive this signed or cancelled contract for historical access. It will remain available for secure review but should no longer be treated as operationally active."
            : "Cancel this contract version. The client will no longer be able to sign it until a revised agreement is issued."
        }
        confirmLabel={
          pendingStatusChange?.nextStatus === "ARCHIVED" ? "Archive contract" : "Cancel contract"
        }
        bullets={
          pendingStatusChange?.nextStatus === "ARCHIVED"
            ? [
                "The contract leaves the active operations queue.",
                "Secure review access remains available for audit and finance reference.",
                "Archived contracts should not be treated as signable or operationally active.",
              ]
            : [
                "The client will lose the ability to sign this version immediately.",
                "Operations history stays visible so the revision trail is preserved.",
                "A new version can still be uploaded and reissued later.",
              ]
        }
        requireAcknowledgement
        acknowledgementLabel={
          pendingStatusChange?.nextStatus === "ARCHIVED"
            ? "I understand this contract will move to historical access only."
            : "I understand this version will stop the current signing flow for the client."
        }
      />
    </>
  )
}
