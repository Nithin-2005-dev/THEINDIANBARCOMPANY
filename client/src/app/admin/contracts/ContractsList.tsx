"use client"

import StatusBadge from "@/components/admin/StatusBadge"
import { EmptyState, Surface } from "@/components/dashboard/DashboardPrimitives"
import { VirtualizedList } from "@/components/dashboard/VirtualizedList"
import { formatDate, formatDateOnly, formatRelativeDate } from "@/lib/admin-format"
import type { Contract } from "@/types/admin"
import type { UseContractsResult } from "./contracts.types"
import styles from "./page.module.css"

const directEditableStatuses: Array<"DRAFT" | "SENT"> = ["DRAFT", "SENT"]

type ContractsListProps = Pick<
  UseContractsResult,
  | "visibleContracts"
  | "statusFilter"
  | "onStatusFilterChange"
  | "isRefreshing"
  | "uploadingContractId"
  | "onOpenContractDocument"
  | "onContractStatusChange"
  | "onRequestDestructiveStatus"
  | "onContractDocumentUpload"
  | "onOpenVersions"
>

type ContractCardProps = {
  contract: Contract
  isUploading: boolean
  onOpenDocument: UseContractsResult["onOpenContractDocument"]
  onStatusChange: UseContractsResult["onContractStatusChange"]
  onRequestDestructiveStatus: UseContractsResult["onRequestDestructiveStatus"]
  onDocumentUpload: UseContractsResult["onContractDocumentUpload"]
  onOpenVersions: UseContractsResult["onOpenVersions"]
}

function getContractNextAction(contract: Contract) {
  if (contract.status === "DRAFT") {
    return "Review the preview, then send the agreement to the client."
  }
  if (contract.status === "SENT") {
    return "Awaiting client review and digital signature."
  }
  if (contract.status === "CANCELLED") {
    return "Issue a revised version if the client re-engages."
  }
  if (contract.status === "ARCHIVED") {
    return "This contract is archived for audit and historical access only."
  }
  if (contract.project) {
    return `Project is active in ${contract.project.status.toLowerCase().replaceAll("_", " ")}.`
  }
  return "Signed successfully. Project provisioning should follow automatically."
}

function ContractLifecycle({ contract }: { contract: Contract }) {
  const steps = [
    { label: "Proposal accepted", complete: true },
    { label: "Contract issued", complete: contract.status !== "DRAFT" },
    { label: "Signed by client", complete: contract.status === "SIGNED" || contract.status === "ARCHIVED" },
    { label: "Archived", complete: contract.status === "ARCHIVED" },
  ]

  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {steps.map((step, index) => (
        <div
          key={step.label}
          className={`rounded-[18px] border px-3 py-3 text-sm ${
            step.complete
              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
              : "border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] text-[var(--dashboard-muted)]"
          }`}
        >
          <p className={styles.eyebrow}>Step {index + 1}</p>
          <p className="mt-2 font-medium">{step.label}</p>
        </div>
      ))}
    </div>
  )
}

function ContractCard({
  contract,
  isUploading,
  onOpenDocument,
  onStatusChange,
  onRequestDestructiveStatus,
  onDocumentUpload,
  onOpenVersions,
}: ContractCardProps) {
  return (
    <article className="rounded-[26px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] p-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--dashboard-text)]">
                {contract.proposal?.title ?? "Contract"}
              </h3>
              <StatusBadge value={contract.status} />
              {contract.project ? <StatusBadge value={contract.project.status} /> : null}
            </div>
            <p className="mt-2 text-sm text-[var(--dashboard-muted)]">
              {contract.proposal?.lead?.client?.name ??
                contract.proposal?.lead?.client?.email ??
                contract.proposal?.lead?.client?.phone ??
                "Client pending"}
            </p>
            <p className="mt-1 text-sm text-[var(--dashboard-muted)]">
              {contract.proposal?.lead?.eventType ?? "Event"} at {contract.proposal?.lead?.location ?? "TBD"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void onOpenDocument(contract.id)}
              className={`${styles.secondaryButton} inline-flex min-h-11 items-center rounded-full px-4 text-sm`}
            >
              Open secure view
            </button>
            <button
              type="button"
              onClick={() => void onOpenVersions(contract)}
              className={`${styles.secondaryButton} inline-flex min-h-11 items-center rounded-full px-4 text-sm`}
            >
              Versions
            </button>
            {contract.status !== "ARCHIVED" ? (
              <label className={`${styles.secondaryButton} inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm`}>
                {isUploading ? "Uploading..." : "Upload revision"}
                <input
                  type="file"
                  className="hidden"
                  disabled={isUploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      void onDocumentUpload(contract.id, file)
                    }
                    event.currentTarget.value = ""
                  }}
                />
              </label>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className={styles.eyebrow}>Event Date</p>
            <p className="mt-2 text-sm font-medium text-[var(--dashboard-text)]">
              {formatDateOnly(contract.proposal?.lead?.eventDate)}
            </p>
          </div>
          <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className={styles.eyebrow}>Created</p>
            <p className="mt-2 text-sm font-medium text-[var(--dashboard-text)]">
              {formatRelativeDate(contract.createdAt)}
            </p>
          </div>
          <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className={styles.eyebrow}>Signed</p>
            <p className="mt-2 text-sm font-medium text-[var(--dashboard-text)]">
              {contract.signedAt ? formatDate(contract.signedAt) : "Awaiting signature"}
            </p>
          </div>
          <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
            <p className={styles.eyebrow}>Next Action</p>
            <p className="mt-2 text-sm font-medium text-[var(--dashboard-text)]">{getContractNextAction(contract)}</p>
          </div>
        </div>

        <ContractLifecycle contract={contract} />
        <div className="flex flex-col gap-3 rounded-[22px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--dashboard-text)]">
              {contract.status === "SIGNED" || contract.status === "ARCHIVED"
                ? `Signed by ${contract.signedByName ?? "client"}`
                : "Contract status control"}
            </p>
            <p className="mt-1 text-sm text-[var(--dashboard-muted)]">
              {contract.status === "ARCHIVED"
                ? "Archived contracts remain available for secure audit access."
                : contract.status === "SIGNED"
                  ? "Project creation is handled after client signature."
                  : "Use draft or sent while iterating. Destructive actions use a confirmation dialog."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {contract.status === "DRAFT" || contract.status === "SENT" ? (
              <select
                className="min-h-11 rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
                value={contract.status}
                onChange={(event) => void onStatusChange(contract, event.target.value as "DRAFT" | "SENT")}
              >
                {directEditableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            ) : null}

            {contract.status !== "ARCHIVED" && contract.status !== "CANCELLED" ? (
              <button
                type="button"
                onClick={() => onRequestDestructiveStatus(contract, "CANCELLED")}
                className={`${styles.secondaryButton} inline-flex min-h-11 items-center rounded-full px-4 text-sm`}
              >
                Cancel
              </button>
            ) : null}

            {contract.status === "SIGNED" || contract.status === "CANCELLED" ? (
              <button
                type="button"
                onClick={() => onRequestDestructiveStatus(contract, "ARCHIVED")}
                className={`${styles.secondaryButton} inline-flex min-h-11 items-center rounded-full px-4 text-sm`}
              >
                Archive
              </button>
            ) : null}

            {contract.project ? (
              <div className={styles.softPill}>
                Project {contract.project.status.replaceAll("_", " ")}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}

export function ContractsList({
  visibleContracts,
  statusFilter,
  onStatusFilterChange,
  isRefreshing,
  uploadingContractId,
  onOpenContractDocument,
  onContractStatusChange,
  onRequestDestructiveStatus,
  onContractDocumentUpload,
  onOpenVersions,
}: ContractsListProps) {
  return (
    <Surface
      title="Contract Queue"
      description="Monitor every issued contract, inspect secure versions, revise documents, and move the agreement into archive when the client lifecycle is complete."
      headerAction={
        <div className="flex flex-wrap items-center gap-3">
          {isRefreshing ? <div className={styles.softPill}>Refreshing</div> : null}
          <select
            className="min-h-11 rounded-[16px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
          >
            <option value="">All contract statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="SIGNED">Signed</option>
            <option value="ARCHIVED">Archived</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      }
    >
      {visibleContracts.length ? (
        <VirtualizedList
          items={visibleContracts}
          itemHeight={420}
          height={Math.min(1100, Math.max(420, visibleContracts.length * 420))}
          overscan={2}
          contentClassName="space-y-4"
          getKey={(contract) => contract.id}
          ariaLabel="Contract queue"
          renderItem={(contract) => (
            <ContractCard
              contract={contract}
              isUploading={uploadingContractId === contract.id}
              onOpenDocument={onOpenContractDocument}
              onStatusChange={onContractStatusChange}
              onRequestDestructiveStatus={onRequestDestructiveStatus}
              onDocumentUpload={onContractDocumentUpload}
              onOpenVersions={onOpenVersions}
            />
          )}
        />
      ) : (
        <EmptyState
          title="No contracts match this view"
          description="Adjust the status filter or generate the first contract from an accepted proposal."
        />
      )}
    </Surface>
  )
}
