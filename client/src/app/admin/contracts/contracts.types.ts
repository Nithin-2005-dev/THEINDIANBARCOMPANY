import type {
  Contract,
  ContractTemplate,
  ContractTemplateField,
  ContractTemplatePreview,
  ContractVersion,
  Proposal,
} from "@/types/admin"

export type DraftStatus = "DRAFT" | "SENT"
export type DestructiveStatus = "CANCELLED" | "ARCHIVED"

export type ContractsData = {
  contracts: Contract[]
  acceptedProposals: Proposal[]
  templates: ContractTemplate[]
}

export type PendingStatusChange = {
  contract: Contract
  nextStatus: DestructiveStatus
}

export type ContractVersionState = {
  contract: Contract | null
  versions: ContractVersion[]
  loading: boolean
  error: string | null
}

export type ContractMetrics = {
  readyToCreate: number
  awaitingSignature: number
  signed: number
  archived: number
}

export type UseContractsResult = {
  data: ContractsData | null
  error: string | null
  isLoading: boolean
  isRefreshing: boolean
  metrics: ContractMetrics
  availableProposals: Proposal[]
  selectedProposal: Proposal | null
  selectedProposalId: string
  onProposalChange: (proposalId: string) => void
  templates: ContractTemplate[]
  selectedTemplate: ContractTemplate | null
  selectedTemplateId: string
  onTemplateChange: (templateId: string) => void
  templateFields: Record<string, string>
  templateFieldDefs: ContractTemplateField[]
  onTemplateFieldChange: (key: string, value: string) => void
  templatePreview: ContractTemplatePreview | null
  previewOpen: boolean
  onPreviewClose: () => void
  onLoadTemplatePreview: (options?: { openPreview?: boolean }) => Promise<void>
  draftStatus: DraftStatus
  onDraftStatusChange: (status: DraftStatus) => void
  documentUrl: string
  onDocumentUrlChange: (value: string) => void
  isCreating: boolean
  isLoadingTemplate: boolean
  isUploadingDraft: boolean
  onDraftUpload: (file: File) => Promise<void>
  onCreateFromTemplate: () => Promise<void>
  onCreateManualContract: () => Promise<void>
  visibleContracts: Contract[]
  statusFilter: string
  onStatusFilterChange: (status: string) => void
  uploadingContractId: string | null
  onOpenContractDocument: (contractId: string) => Promise<void>
  onContractStatusChange: (contract: Contract, nextStatus: DraftStatus) => Promise<void>
  pendingStatusChange: PendingStatusChange | null
  onRequestDestructiveStatus: (contract: Contract, nextStatus: DestructiveStatus) => void
  onCancelDestructiveStatus: () => void
  onConfirmDestructiveStatus: () => Promise<void>
  isSavingStatus: boolean
  onContractDocumentUpload: (contractId: string, file: File) => Promise<void>
  versionState: ContractVersionState
  onOpenVersions: (contract: Contract) => Promise<void>
  onCloseVersions: () => void
}

export const emptyVersionState: ContractVersionState = {
  contract: null,
  versions: [],
  loading: false,
  error: null,
}
