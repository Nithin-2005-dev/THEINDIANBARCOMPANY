"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAdminResource } from "@/components/admin/useAdminResource"
import { useToast } from "@/components/dashboard/ToastProvider"
import { adminApi } from "@/lib/admin-client"
import { uploadFileToPresignedUrl } from "@/lib/uploads"
import type { ContractTemplateField, ContractTemplatePreview } from "@/types/admin"
import {
  getAvailableProposals,
  getContractMetrics,
  getSelectedProposal,
  getSelectedTemplate,
} from "./contracts.selectors"
import type {
  ContractsData,
  DraftStatus,
  UseContractsResult,
} from "./contracts.types"
import { useContractQueue } from "./useContractQueue"

export function useContracts(): UseContractsResult {
  const { pushToast } = useToast()
  const [selectedProposalId, setSelectedProposalId] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("SENT")
  const [documentUrl, setDocumentUrl] = useState("")
  const [templateFields, setTemplateFields] = useState<Record<string, string>>({})
  const [templateFieldDefs, setTemplateFieldDefs] = useState<ContractTemplateField[]>([])
  const [templatePreview, setTemplatePreview] = useState<ContractTemplatePreview | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)
  const [isUploadingDraft, setIsUploadingDraft] = useState(false)

  const { data, error, isLoading, isRefreshing, reload } = useAdminResource<ContractsData>(async () => {
    const [contracts, acceptedProposals, templates] = await Promise.all([
      adminApi.listContracts(),
      adminApi.listProposals(new URLSearchParams({ page: "1", limit: "100", status: "ACCEPTED" })),
      adminApi.listContractTemplates(),
    ])

    return {
      contracts,
      acceptedProposals: acceptedProposals.items,
      templates,
    }
  }, [], {
    refreshIntervalMs: 30000,
  })

  const availableProposals = useMemo(
    () => getAvailableProposals(data?.acceptedProposals),
    [data?.acceptedProposals],
  )
  const selectedProposal = useMemo(
    () => getSelectedProposal(availableProposals, selectedProposalId),
    [availableProposals, selectedProposalId],
  )
  const selectedTemplate = useMemo(
    () => getSelectedTemplate(data?.templates, selectedTemplateId),
    [data?.templates, selectedTemplateId],
  )
  const metrics = useMemo(
    () => getContractMetrics(data?.contracts, availableProposals.length),
    [availableProposals.length, data?.contracts],
  )
  const queue = useContractQueue({
    contracts: data?.contracts,
    reload,
    pushToast,
  })

  const resetTemplateDraft = useCallback(() => {
    setTemplateFields({})
    setTemplateFieldDefs([])
    setTemplatePreview(null)
    setPreviewOpen(false)
  }, [])

  const onLoadTemplatePreview = useCallback(async (options?: { openPreview?: boolean }) => {
    if (!selectedProposalId || !selectedTemplateId) {
      return
    }

    setIsLoadingTemplate(true)
    try {
      const preview = await adminApi.previewContractTemplate({
        proposalId: selectedProposalId,
        templateId: selectedTemplateId,
        fields: Object.keys(templateFields).length ? templateFields : undefined,
      })
      setTemplatePreview(preview)
      setTemplateFieldDefs(preview.fields)
      setTemplateFields((current) => {
        const next = { ...current }
        for (const field of preview.fields) {
          if (!next[field.key]) {
            next[field.key] = field.value
          }
        }
        return next
      })
      if (options?.openPreview) {
        setPreviewOpen(true)
      }
    } catch (previewError) {
      pushToast({
        title: "Unable to load template preview",
        description: previewError instanceof Error ? previewError.message : "Please try again.",
        tone: "error",
      })
    } finally {
      setIsLoadingTemplate(false)
    }
  }, [pushToast, selectedProposalId, selectedTemplateId, templateFields])

  const loadInitialTemplatePreview = useCallback(async () => {
    if (!selectedProposalId || !selectedTemplateId) {
      return
    }

    setIsLoadingTemplate(true)
    try {
      const preview = await adminApi.previewContractTemplate({
        proposalId: selectedProposalId,
        templateId: selectedTemplateId,
      })
      setTemplatePreview(preview)
      setTemplateFieldDefs(preview.fields)
      setTemplateFields(Object.fromEntries(preview.fields.map((field) => [field.key, field.value])))
    } catch (previewError) {
      pushToast({
        title: "Unable to load template preview",
        description: previewError instanceof Error ? previewError.message : "Please try again.",
        tone: "error",
      })
    } finally {
      setIsLoadingTemplate(false)
    }
  }, [pushToast, selectedProposalId, selectedTemplateId])

  useEffect(() => {
    if (selectedProposalId && selectedTemplateId) {
      void loadInitialTemplatePreview()
    }
  }, [loadInitialTemplatePreview, selectedProposalId, selectedTemplateId])

  const onProposalChange = useCallback((proposalId: string) => {
    if (proposalId === selectedProposalId) {
      return
    }

    setSelectedProposalId(proposalId)
    resetTemplateDraft()
  }, [resetTemplateDraft, selectedProposalId])

  const onTemplateChange = useCallback((templateId: string) => {
    if (templateId === selectedTemplateId) {
      return
    }

    setSelectedTemplateId(templateId)
    resetTemplateDraft()
  }, [resetTemplateDraft, selectedTemplateId])

  const onTemplateFieldChange = useCallback((key: string, value: string) => {
    setTemplateFields((current) => ({
      ...current,
      [key]: value,
    }))
  }, [])

  const onDraftStatusChange = useCallback((status: DraftStatus) => {
    setDraftStatus(status)
  }, [])

  const onDocumentUrlChange = useCallback((value: string) => {
    setDocumentUrl(value)
  }, [])

  const onPreviewClose = useCallback(() => {
    setPreviewOpen(false)
  }, [])

  const onDraftUpload = useCallback(async (file: File) => {
    if (!selectedProposalId) {
      pushToast({
        title: "Select a proposal first",
        description: "Choose the accepted proposal before uploading the contract file.",
        tone: "error",
      })
      return
    }

    setIsUploadingDraft(true)
    try {
      const upload = await adminApi.createContractDraftDocumentUploadUrl(selectedProposalId, {
        fileName: file.name,
        contentType: file.type || "application/pdf",
        sizeBytes: file.size,
      })
      await uploadFileToPresignedUrl(upload.url, file)
      setDocumentUrl(upload.fileUrl)
      pushToast({
        title: "Manual document uploaded",
        description: "The uploaded file is ready for the fallback manual contract path.",
        tone: "success",
      })
    } catch (uploadError) {
      pushToast({
        title: "Upload failed",
        description: uploadError instanceof Error ? uploadError.message : "Unable to upload contract document.",
        tone: "error",
      })
    } finally {
      setIsUploadingDraft(false)
    }
  }, [pushToast, selectedProposalId])

  const onCreateFromTemplate = useCallback(async () => {
    if (!selectedProposalId || !selectedTemplateId) {
      pushToast({
        title: "Missing template details",
        description: "Choose an accepted proposal and a contract template first.",
        tone: "error",
      })
      return
    }

    setIsCreating(true)
    try {
      await adminApi.createContractFromTemplate({
        proposalId: selectedProposalId,
        templateId: selectedTemplateId,
        fields: templateFields,
        status: draftStatus,
      })
      setSelectedProposalId("")
      setSelectedTemplateId("")
      setDraftStatus("SENT")
      setTemplateFields({})
      setTemplateFieldDefs([])
      setTemplatePreview(null)
      pushToast({
        title: "Contract generated",
        description: "The template contract is now saved and ready for the client workflow.",
        tone: "success",
      })
      await reload()
    } catch (creationError) {
      pushToast({
        title: "Unable to generate contract",
        description: creationError instanceof Error ? creationError.message : "Please try again.",
        tone: "error",
      })
    } finally {
      setIsCreating(false)
    }
  }, [draftStatus, pushToast, reload, selectedProposalId, selectedTemplateId, templateFields])

  const onCreateManualContract = useCallback(async () => {
    if (!selectedProposalId || !documentUrl.trim()) {
      pushToast({
        title: "Missing document",
        description: "Upload or paste a hosted document URL before using the manual fallback path.",
        tone: "error",
      })
      return
    }

    setIsCreating(true)
    try {
      await adminApi.createContract({
        proposalId: selectedProposalId,
        documentUrl: documentUrl.trim(),
        status: draftStatus,
      })
      setDocumentUrl("")
      setSelectedProposalId("")
      pushToast({
        title: "Manual contract created",
        description: "The uploaded document is now attached to the contract record.",
        tone: "success",
      })
      await reload()
    } catch (creationError) {
      pushToast({
        title: "Unable to create manual contract",
        description: creationError instanceof Error ? creationError.message : "Please try again.",
        tone: "error",
      })
    } finally {
      setIsCreating(false)
    }
  }, [documentUrl, draftStatus, pushToast, reload, selectedProposalId])

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    metrics,
    availableProposals,
    selectedProposal,
    selectedProposalId,
    onProposalChange,
    templates: data?.templates ?? [],
    selectedTemplate,
    selectedTemplateId,
    onTemplateChange,
    templateFields,
    templateFieldDefs,
    onTemplateFieldChange,
    templatePreview,
    previewOpen,
    onPreviewClose,
    onLoadTemplatePreview,
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
    visibleContracts: queue.visibleContracts,
    statusFilter: queue.statusFilter,
    onStatusFilterChange: queue.onStatusFilterChange,
    uploadingContractId: queue.uploadingContractId,
    onOpenContractDocument: queue.onOpenContractDocument,
    onContractStatusChange: queue.onContractStatusChange,
    pendingStatusChange: queue.pendingStatusChange,
    onRequestDestructiveStatus: queue.onRequestDestructiveStatus,
    onCancelDestructiveStatus: queue.onCancelDestructiveStatus,
    onConfirmDestructiveStatus: queue.onConfirmDestructiveStatus,
    isSavingStatus: queue.isSavingStatus,
    onContractDocumentUpload: queue.onContractDocumentUpload,
    versionState: queue.versionState,
    onOpenVersions: queue.onOpenVersions,
    onCloseVersions: queue.onCloseVersions,
  }
}
