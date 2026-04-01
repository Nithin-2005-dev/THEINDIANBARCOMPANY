"use client"

import { useCallback, useMemo, useState } from "react"
import { useToast } from "@/components/dashboard/ToastProvider"
import { adminApi } from "@/lib/admin-client"
import { uploadFileToPresignedUrl } from "@/lib/uploads"
import type { Contract } from "@/types/admin"
import { getVisibleContracts } from "./contracts.selectors"
import type { DraftStatus, PendingStatusChange } from "./contracts.types"
import { emptyVersionState } from "./contracts.types"

type UseContractQueueParams = {
  contracts: Contract[] | undefined
  reload: () => Promise<void>
  pushToast: ReturnType<typeof useToast>["pushToast"]
}

export function useContractQueue({ contracts, reload, pushToast }: UseContractQueueParams) {
  const [statusFilter, setStatusFilter] = useState("")
  const [uploadingContractId, setUploadingContractId] = useState<string | null>(null)
  const [pendingStatusChange, setPendingStatusChange] = useState<PendingStatusChange | null>(null)
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [versionState, setVersionState] = useState(emptyVersionState)

  const visibleContracts = useMemo(
    () => getVisibleContracts(contracts, statusFilter),
    [contracts, statusFilter],
  )

  const onStatusFilterChange = useCallback((status: string) => {
    setStatusFilter(status)
  }, [])

  const onOpenContractDocument = useCallback(async (contractId: string) => {
    try {
      const access = await adminApi.getContractDocumentAccessUrl(contractId)
      window.open(access.url, "_blank", "noopener,noreferrer")
    } catch (accessError) {
      pushToast({
        title: "Unable to open document",
        description: accessError instanceof Error ? accessError.message : "Please try again.",
        tone: "error",
      })
    }
  }, [pushToast])

  const onContractStatusChange = useCallback(async (contract: Contract, nextStatus: DraftStatus) => {
    if (contract.status === nextStatus) {
      return
    }

    try {
      await adminApi.updateContractStatus(contract.id, nextStatus)
      pushToast({
        title: "Contract updated",
        description: `Status changed to ${nextStatus.replaceAll("_", " ")}.`,
        tone: "success",
        actionLabel: "Undo",
        onAction: async () => {
          await adminApi.updateContractStatus(contract.id, contract.status)
          pushToast({
            title: "Contract restored",
            description: `Status moved back to ${contract.status.replaceAll("_", " ")}.`,
            tone: "success",
          })
          await reload()
        },
      })
      await reload()
    } catch (updateError) {
      pushToast({
        title: "Unable to update contract",
        description: updateError instanceof Error ? updateError.message : "Please try again.",
        tone: "error",
      })
    }
  }, [pushToast, reload])

  const onRequestDestructiveStatus = useCallback((contract: Contract, nextStatus: "CANCELLED" | "ARCHIVED") => {
    setPendingStatusChange({ contract, nextStatus })
  }, [])

  const onCancelDestructiveStatus = useCallback(() => {
    setPendingStatusChange(null)
  }, [])

  const onConfirmDestructiveStatus = useCallback(async () => {
    if (!pendingStatusChange) {
      return
    }

    setIsSavingStatus(true)
    try {
      await adminApi.updateContractStatus(
        pendingStatusChange.contract.id,
        pendingStatusChange.nextStatus,
      )
      pushToast({
        title: `Contract ${pendingStatusChange.nextStatus.toLowerCase()}`,
        description:
          pendingStatusChange.nextStatus === "ARCHIVED"
            ? "The contract has been archived for historical access."
            : "The client will no longer be able to sign this version.",
        tone: "success",
      })
      setPendingStatusChange(null)
      await reload()
    } catch (updateError) {
      pushToast({
        title: "Unable to update contract",
        description: updateError instanceof Error ? updateError.message : "Please try again.",
        tone: "error",
      })
    } finally {
      setIsSavingStatus(false)
    }
  }, [pendingStatusChange, pushToast, reload])

  const onContractDocumentUpload = useCallback(async (contractId: string, file: File) => {
    setUploadingContractId(contractId)
    try {
      const upload = await adminApi.createContractDocumentUploadUrl(contractId, {
        fileName: file.name,
        contentType: file.type || "application/pdf",
        sizeBytes: file.size,
      })
      await uploadFileToPresignedUrl(upload.url, file)
      pushToast({
        title: "Revision uploaded",
        description: "A new contract document version is now linked on the record.",
        tone: "success",
      })
      await reload()
    } catch (uploadError) {
      pushToast({
        title: "Unable to upload revision",
        description: uploadError instanceof Error ? uploadError.message : "Please try again.",
        tone: "error",
      })
    } finally {
      setUploadingContractId(null)
    }
  }, [pushToast, reload])

  const onOpenVersions = useCallback(async (contract: Contract) => {
    setVersionState({
      contract,
      versions: [],
      loading: true,
      error: null,
    })

    try {
      const versions = await adminApi.listContractVersions(contract.id)
      setVersionState({
        contract,
        versions,
        loading: false,
        error: null,
      })
    } catch (versionError) {
      setVersionState({
        contract,
        versions: [],
        loading: false,
        error: versionError instanceof Error ? versionError.message : "Unable to load versions.",
      })
    }
  }, [])

  const onCloseVersions = useCallback(() => {
    setVersionState(emptyVersionState)
  }, [])

  return {
    visibleContracts,
    statusFilter,
    onStatusFilterChange,
    uploadingContractId,
    onOpenContractDocument,
    onContractStatusChange,
    pendingStatusChange,
    onRequestDestructiveStatus,
    onCancelDestructiveStatus,
    onConfirmDestructiveStatus,
    isSavingStatus,
    onContractDocumentUpload,
    versionState,
    onOpenVersions,
    onCloseVersions,
  }
}
