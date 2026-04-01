import type { Contract, ContractTemplate, Proposal } from "@/types/admin"
import type { ContractMetrics } from "./contracts.types"

export function getAvailableProposals(acceptedProposals: Proposal[] = []) {
  return acceptedProposals.filter((proposal) => !proposal.contract)
}

export function getSelectedProposal(availableProposals: Proposal[], selectedProposalId: string) {
  return availableProposals.find((proposal) => proposal.id === selectedProposalId) ?? null
}

export function getSelectedTemplate(templates: ContractTemplate[] = [], selectedTemplateId: string) {
  return templates.find((template) => template.id === selectedTemplateId) ?? null
}

export function getVisibleContracts(contracts: Contract[] = [], statusFilter: string) {
  return statusFilter ? contracts.filter((contract) => contract.status === statusFilter) : contracts
}

export function getContractMetrics(
  contracts: Contract[] = [],
  readyToCreate: number,
): ContractMetrics {
  return {
    readyToCreate,
    awaitingSignature: contracts.filter((contract) => contract.status === "SENT").length,
    signed: contracts.filter((contract) => contract.status === "SIGNED").length,
    archived: contracts.filter((contract) => contract.status === "ARCHIVED").length,
  }
}
