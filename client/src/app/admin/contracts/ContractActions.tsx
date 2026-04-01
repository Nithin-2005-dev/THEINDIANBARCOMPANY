"use client"

import type { FormEvent } from "react"
import { DashboardButton, Surface } from "@/components/dashboard/DashboardPrimitives"
import { formatDateOnly } from "@/lib/admin-format"
import type { UseContractsResult } from "./contracts.types"
import styles from "./page.module.css"

const draftStatuses: Array<"DRAFT" | "SENT"> = ["DRAFT", "SENT"]

type ContractActionsProps = Pick<
  UseContractsResult,
  | "availableProposals"
  | "selectedProposal"
  | "selectedProposalId"
  | "onProposalChange"
  | "templates"
  | "selectedTemplate"
  | "selectedTemplateId"
  | "onTemplateChange"
  | "templateFields"
  | "templateFieldDefs"
  | "onTemplateFieldChange"
  | "draftStatus"
  | "onDraftStatusChange"
  | "documentUrl"
  | "onDocumentUrlChange"
  | "isCreating"
  | "isLoadingTemplate"
  | "isUploadingDraft"
  | "onDraftUpload"
  | "onCreateFromTemplate"
  | "onCreateManualContract"
  | "onLoadTemplatePreview"
>

export function ContractActions({
  availableProposals,
  selectedProposal,
  selectedProposalId,
  onProposalChange,
  templates,
  selectedTemplate,
  selectedTemplateId,
  onTemplateChange,
  templateFields,
  templateFieldDefs,
  onTemplateFieldChange,
  draftStatus,
  onDraftStatusChange,
  documentUrl,
  onDocumentUrlChange,
  isCreating,
  isLoadingTemplate,
  isUploadingDraft,
  onDraftUpload,
  onCreateFromTemplate,
  onCreateManualContract,
  onLoadTemplatePreview,
}: ContractActionsProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onCreateFromTemplate()
  }

  return (
    <Surface
      title="Generate Contract"
      description="Choose the accepted proposal, load a template, preview the final document, and then save it as draft or send it immediately."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
            Accepted proposal
            <select
              className="min-h-12 rounded-[18px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
              value={selectedProposalId}
              onChange={(event) => onProposalChange(event.target.value)}
            >
              <option value="">Choose a proposal ready for contracting</option>
              {availableProposals.map((proposal) => (
                <option key={proposal.id} value={proposal.id}>
                  {proposal.title} | {proposal.lead?.eventType ?? proposal.id}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
            Contract template
            <select
              className="min-h-12 rounded-[18px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
              value={selectedTemplateId}
              onChange={(event) => onTemplateChange(event.target.value)}
            >
              <option value="">Choose a template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>

          {selectedProposal ? (
            <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
              <p className="text-sm font-medium text-[var(--dashboard-text)]">{selectedProposal.title}</p>
              <p className="mt-1 text-sm text-[var(--dashboard-muted)]">
                {selectedProposal.lead?.eventType ?? "Event"} at {selectedProposal.lead?.location ?? "TBD"} on{" "}
                {formatDateOnly(selectedProposal.lead?.eventDate)}
              </p>
            </div>
          ) : null}

          {selectedTemplate ? (
            <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4">
              <p className="text-sm font-medium text-[var(--dashboard-text)]">{selectedTemplate.name}</p>
              <p className="mt-1 text-sm text-[var(--dashboard-muted)]">{selectedTemplate.description}</p>
            </div>
          ) : null}

          {templateFieldDefs.length ? (
            <div className="grid gap-4">
              {templateFieldDefs.map((field) =>
                field.type === "textarea" ? (
                  <label key={field.key} className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
                    {field.label}
                    <textarea
                      value={templateFields[field.key] ?? field.value}
                      onChange={(event) => onTemplateFieldChange(field.key, event.target.value)}
                      className="min-h-24 rounded-[18px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--dashboard-text)] outline-none"
                    />
                    {field.helperText ? (
                      <span className="text-xs text-[var(--dashboard-subtle)]">{field.helperText}</span>
                    ) : null}
                  </label>
                ) : (
                  <label key={field.key} className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
                    {field.label}
                    <input
                      type={field.type}
                      value={templateFields[field.key] ?? field.value}
                      onChange={(event) => onTemplateFieldChange(field.key, event.target.value)}
                      className="min-h-12 rounded-[18px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
                    />
                    {field.helperText ? (
                      <span className="text-xs text-[var(--dashboard-subtle)]">{field.helperText}</span>
                    ) : null}
                  </label>
                ),
              )}
            </div>
          ) : null}

          <label className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
            Initial status
            <select
              className="min-h-12 rounded-[18px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
              value={draftStatus}
              onChange={(event) => onDraftStatusChange(event.target.value as "DRAFT" | "SENT")}
            >
              {draftStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-[20px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--dashboard-muted)]">
          Template-generated contracts are stored on managed object storage, versioned, and structured for today&apos;s native portal signature flow plus future external e-sign integration.
        </div>

        <div className="flex flex-wrap gap-3">
          <DashboardButton
            type="button"
            tone="secondary"
            onClick={() => void onLoadTemplatePreview({ openPreview: true })}
            disabled={!selectedProposalId || !selectedTemplateId || isLoadingTemplate}
          >
            {isLoadingTemplate ? "Loading preview..." : "Preview Contract"}
          </DashboardButton>
          <DashboardButton type="submit" disabled={isCreating || !selectedProposalId || !selectedTemplateId}>
            {isCreating ? "Generating..." : "Generate Contract"}
          </DashboardButton>
        </div>
      </form>

      <div className="mt-6 border-t border-[var(--dashboard-border)] pt-6">
        <p className="text-sm font-medium text-[var(--dashboard-text)]">Manual fallback</p>
        <p className="mt-2 text-sm text-[var(--dashboard-muted)]">
          Use this only when a one-off legal document has been prepared outside the template system.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
          <label className="grid gap-2 text-sm text-[var(--dashboard-muted)]">
            Hosted document URL
            <input
              value={documentUrl}
              onChange={(event) => onDocumentUrlChange(event.target.value)}
              placeholder="https://..."
              className="min-h-12 rounded-[18px] border border-[var(--dashboard-border)] bg-[rgba(255,255,255,0.04)] px-4 text-sm text-[var(--dashboard-text)] outline-none"
            />
          </label>
          <label className={`${styles.secondaryButton} inline-flex min-h-12 cursor-pointer items-center justify-center rounded-[18px] px-4 text-sm`}>
            {isUploadingDraft ? "Uploading..." : "Upload file"}
            <input
              type="file"
              className="hidden"
              disabled={isUploadingDraft}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  void onDraftUpload(file)
                }
                event.currentTarget.value = ""
              }}
            />
          </label>
        </div>
        <div className="mt-4">
          <DashboardButton type="button" tone="secondary" onClick={() => void onCreateManualContract()} disabled={isCreating}>
            Create From Uploaded Document
          </DashboardButton>
        </div>
      </div>
    </Surface>
  )
}
