"use client"

import {
  DashboardPage,
  ErrorState,
  InlineNotice,
  MetricCard,
  PageHero,
  SkeletonMetricGrid,
  SkeletonPageHero,
  SkeletonSurface,
} from "@/components/dashboard/DashboardPrimitives"
import { useAssistantPageState } from "@/lib/assistant-page-state"
import { ContractActions } from "./ContractActions"
import { ContractDetails } from "./ContractDetails"
import { ContractsList } from "./ContractsList"
import { useContracts } from "./useContracts"

export default function AdminContractsPage() {
  const contracts = useContracts()

  useAssistantPageState({
    currentTab: "contracts",
    currentView: "admin-contracts",
    selectedContractId: contracts.versionState.contract?.id ?? null,
    unsignedContractCount: contracts.metrics.readyToCreate + contracts.metrics.awaitingSignature,
    filters: {
      status: contracts.statusFilter || null,
    },
  })

  if (contracts.isLoading) {
    return (
      <DashboardPage>
        <SkeletonPageHero />
        <SkeletonMetricGrid count={4} />
        <SkeletonSurface itemCount={4} />
      </DashboardPage>
    )
  }

  if (!contracts.data) {
    return (
      <ErrorState
        title="Contracts unavailable"
        description={contracts.error ?? "Unable to load contract operations."}
      />
    )
  }

  return (
    <>
      <DashboardPage>
        <PageHero
          eyebrow="Contracts"
          title="Generate contracts from templates, preview them, and control revisions safely."
          description="This workspace now supports contract templates, preview-first generation, version history, secure document access, and lifecycle tracking from accepted proposal through signature and archival."
          action={{ label: "Open Projects", href: "/admin/projects" }}
          secondaryAction={{ label: "View Payments", href: "/admin/payments" }}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Ready To Issue" value={contracts.metrics.readyToCreate} hint="Accepted proposals with no contract yet." />
          <MetricCard label="Awaiting Signature" value={contracts.metrics.awaitingSignature} hint="Contracts already sent to clients." />
          <MetricCard label="Signed" value={contracts.metrics.signed} hint="Client signatures completed." />
          <MetricCard label="Archived" value={contracts.metrics.archived} hint="Historical contracts retained for audit." />
        </div>

        {contracts.error ? (
          <InlineNotice
            tone="warning"
            title="Showing the last successful contract queue"
            description={`${contracts.error} Template previews, version history, and secure access actions will continue working while background refresh retries.`}
          />
        ) : null}

        <div className="grid gap-6 2xl:grid-cols-[0.9fr_1.1fr]">
          <ContractActions
            availableProposals={contracts.availableProposals}
            selectedProposal={contracts.selectedProposal}
            selectedProposalId={contracts.selectedProposalId}
            onProposalChange={contracts.onProposalChange}
            templates={contracts.templates}
            selectedTemplate={contracts.selectedTemplate}
            selectedTemplateId={contracts.selectedTemplateId}
            onTemplateChange={contracts.onTemplateChange}
            templateFields={contracts.templateFields}
            templateFieldDefs={contracts.templateFieldDefs}
            onTemplateFieldChange={contracts.onTemplateFieldChange}
            draftStatus={contracts.draftStatus}
            onDraftStatusChange={contracts.onDraftStatusChange}
            documentUrl={contracts.documentUrl}
            onDocumentUrlChange={contracts.onDocumentUrlChange}
            isCreating={contracts.isCreating}
            isLoadingTemplate={contracts.isLoadingTemplate}
            isUploadingDraft={contracts.isUploadingDraft}
            onDraftUpload={contracts.onDraftUpload}
            onCreateFromTemplate={contracts.onCreateFromTemplate}
            onCreateManualContract={contracts.onCreateManualContract}
            onLoadTemplatePreview={contracts.onLoadTemplatePreview}
          />

          <ContractsList
            visibleContracts={contracts.visibleContracts}
            statusFilter={contracts.statusFilter}
            onStatusFilterChange={contracts.onStatusFilterChange}
            isRefreshing={contracts.isRefreshing}
            uploadingContractId={contracts.uploadingContractId}
            onOpenContractDocument={contracts.onOpenContractDocument}
            onContractStatusChange={contracts.onContractStatusChange}
            onRequestDestructiveStatus={contracts.onRequestDestructiveStatus}
            onContractDocumentUpload={contracts.onContractDocumentUpload}
            onOpenVersions={contracts.onOpenVersions}
          />
        </div>
      </DashboardPage>

      <ContractDetails
        previewOpen={contracts.previewOpen}
        templatePreview={contracts.templatePreview}
        onPreviewClose={contracts.onPreviewClose}
        versionState={contracts.versionState}
        onCloseVersions={contracts.onCloseVersions}
        pendingStatusChange={contracts.pendingStatusChange}
        onCancelDestructiveStatus={contracts.onCancelDestructiveStatus}
        onConfirmDestructiveStatus={contracts.onConfirmDestructiveStatus}
        isSavingStatus={contracts.isSavingStatus}
      />
    </>
  )
}
