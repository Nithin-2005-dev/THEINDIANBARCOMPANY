"use client"

import { apiRequest, normalizeApiError, redirectOnUnauthorized } from "@/lib/api"
import { getRoleLoginPath } from "@/lib/auth-routes"
import type {
  PortalConversationType,
  PortalMessage,
  PortalThreadPage,
} from "@/types/client-portal"
import type {
  AdminAssistantAnalytics,
  AdminAnalyticsResponse,
  AdminRole,
  AdminSystemOverview,
  AppNotification,
  AdminUser,
  Contract,
  ContractTemplate,
  ContractTemplatePreview,
  ContractVersion,
  InboxThread,
  Lead,
  LeadActivity,
  LeadNote,
  LeadStatus,
  LeadStatusHistory,
  PaginatedResponse,
  Payment,
  PaymentStatus,
  Project,
  ProjectStatus,
  ProjectUpdate,
  Proposal,
  StaffAssignment,
  Vendor,
} from "@/types/admin"
import type {
  AdminTeamMember,
  TeamImageUploadSignature,
  TeamMemberMutationPayload,
} from "@/types/team"

export class AdminApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "AdminApiError"
    this.status = status
  }
}

function getAdminLoginRedirect() {
  if (typeof window === "undefined") {
    return getRoleLoginPath("ADMIN")
  }

  const nextPath = `${window.location.pathname}${window.location.search}`
  return getRoleLoginPath("ADMIN", nextPath)
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET"
  const body =
    typeof init?.body === "string" && init.body.length > 0
      ? JSON.parse(init.body)
      : init?.body

  return apiRequest<T>({
    url: `/admin/proxy${path}`,
    method,
    data: body,
    headers: init?.headers as Record<string, string> | undefined,
  }).catch((error) => {
    const normalizedError = redirectOnUnauthorized(error, getAdminLoginRedirect())
    throw new AdminApiError(normalizedError.message ?? "Request failed.", normalizedError.status ?? 0)
  })
}

function withConversationType(path: string, conversationType?: PortalConversationType) {
  if (!conversationType) return path

  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}conversationType=${conversationType}`
}

export const adminApi = {
  me: () =>
    apiRequest<AdminUser>({
      url: "/admin/auth/me",
    }).catch((error) => {
      const normalizedError = normalizeApiError(
        redirectOnUnauthorized(error, getAdminLoginRedirect()),
      )
      throw new AdminApiError(normalizedError.message ?? "Unauthorized", normalizedError.status)
    }),
  analytics: () => adminFetch<AdminAnalyticsResponse>("/admin/analytics"),
  assistantAnalytics: (params?: {
    range?: "7d" | "30d"
    role?: "all" | AdminRole
    pageKey?: string
    search?: string
  }) => {
    const query = new URLSearchParams()
    if (params?.range) query.set("range", params.range)
    if (params?.role) query.set("role", params.role)
    if (params?.pageKey?.trim()) query.set("pageKey", params.pageKey.trim())
    if (params?.search?.trim()) query.set("search", params.search.trim())
    return adminFetch<AdminAssistantAnalytics>(
      `/admin/assistant/analytics${query.toString() ? `?${query.toString()}` : ""}`,
    )
  },
  pipeline: () => adminFetch<Lead[]>("/admin/pipeline"),
  systemOverview: () => adminFetch<AdminSystemOverview>("/admin/system/overview"),
  listLeads: (params: URLSearchParams) =>
    adminFetch<PaginatedResponse<Lead>>(`/leads?${params.toString()}`),
  createOfflineLead: (payload: {
    clientName: string
    clientEmail: string
    clientPhone?: string
    eventType: string
    location: string
    city?: string
    packageName?: string
    packageLabel?: string
    addOns?: string[]
    eventDate: string
    guestCount?: number
    budgetMin?: number
    budgetMax?: number
    notes?: string
  }) =>
    adminFetch<{ id: string; status: LeadStatus; clientId: string }>("/leads/offline", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getLead: (id: string) => adminFetch<Lead>(`/leads/${id}`),
  listLeadNotes: (id: string) => adminFetch<LeadNote[]>(`/leads/${id}/notes`),
  createLeadNote: (id: string, content: string) =>
    adminFetch<LeadNote>(`/leads/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  deleteLeadNote: (id: string, noteId: string) =>
    adminFetch<LeadNote>(`/leads/${id}/notes/${noteId}`, {
      method: "DELETE",
    }),
  listLeadTimeline: (id: string) => adminFetch<LeadActivity[]>(`/leads/${id}/timeline`),
  addLeadTimelineEntry: (id: string, description: string) =>
    adminFetch<LeadActivity>(`/leads/${id}/timeline/manual`, {
      method: "POST",
      body: JSON.stringify({ description }),
    }),
  listLeadStatusHistory: (id: string) =>
    adminFetch<LeadStatusHistory[]>(`/leads/${id}/status-history`),
  listLeadAssignments: (id: string) =>
    adminFetch<StaffAssignment[]>(`/leads/${id}/assignments`),
  listInbox: () => adminFetch<InboxThread[]>("/client-portal/inbox"),
  listNotifications: () => adminFetch<AppNotification[]>("/admin/notifications"),
  markNotificationRead: (id: string) =>
    adminFetch(`/admin/notifications/${id}/read`, {
      method: "PATCH",
    }),
  getLeadThread: (id: string, conversationType?: PortalConversationType) =>
    adminFetch<PortalMessage[]>(withConversationType(`/client-portal/events/${id}/thread`, conversationType)),
  getLeadThreadWindow: (
    id: string,
    options?: {
      conversationType?: PortalConversationType
      limit?: number
      beforeCreatedAt?: string
      beforeId?: string
      search?: string
      date?: string
      hasAttachment?: boolean
    },
  ) => {
    const params = new URLSearchParams()
    if (options?.conversationType) params.set("conversationType", options.conversationType)
    if (options?.limit) params.set("limit", String(options.limit))
    if (options?.beforeCreatedAt) params.set("beforeCreatedAt", options.beforeCreatedAt)
    if (options?.beforeId) params.set("beforeId", options.beforeId)
    if (options?.search?.trim()) params.set("search", options.search.trim())
    if (options?.date) params.set("date", options.date)
    if (options?.hasAttachment) params.set("hasAttachment", "true")
    const query = params.toString()

    return adminFetch<PortalThreadPage>(`/client-portal/events/${id}/thread-window${query ? `?${query}` : ""}`)
  },
  sendLeadMessage: (
    id: string,
    payload: { body: string; attachmentName?: string; attachmentKey?: string; attachmentUrl?: string },
    conversationType?: PortalConversationType,
  ) =>
    adminFetch<PortalMessage>(withConversationType(`/client-portal/events/${id}/messages`, conversationType), {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createLeadMessageUploadUrl: (
    id: string,
    payload: { fileName: string; contentType: string; sizeBytes: number },
    conversationType?: PortalConversationType,
  ) =>
    adminFetch<{ url: string; fileUrl: string; key: string }>(withConversationType(`/client-portal/events/${id}/message-upload-url`, conversationType), {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateLeadTypingStatus: (id: string, isTyping: boolean, conversationType?: PortalConversationType) =>
    adminFetch<{ success: boolean }>(withConversationType(`/client-portal/events/${id}/typing`, conversationType), {
      method: "POST",
      body: JSON.stringify({ isTyping }),
    }),
  assignLeadStaff: (
    id: string,
    payload: { userId: string; role: "PRIMARY" | "SUPPORTING"; notes?: string },
  ) =>
    adminFetch<StaffAssignment>(`/leads/${id}/assignments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateLeadStatus: (id: string, status: LeadStatus) =>
    adminFetch<Lead>(`/leads/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  listProposals: (params: URLSearchParams) =>
    adminFetch<PaginatedResponse<Proposal>>(`/proposals?${params.toString()}`),
  createProposal: (payload: Record<string, unknown>) =>
    adminFetch<Proposal>("/proposals", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listContractTemplates: () => adminFetch<ContractTemplate[]>("/contracts/templates"),
  previewContractTemplate: (payload: {
    proposalId: string
    templateId: string
    fields?: Record<string, string>
  }) =>
    adminFetch<ContractTemplatePreview>("/contracts/templates/preview", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createContractFromTemplate: (payload: {
    proposalId: string
    templateId: string
    fields?: Record<string, string>
    status?: Exclude<Contract["status"], "ARCHIVED" | "SIGNED" | "CANCELLED">
  }) =>
    adminFetch<Contract>("/contracts/templates/create", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createContract: (payload: {
    proposalId: string
    documentUrl: string
    status?: Contract["status"]
  }) =>
    adminFetch<Contract>("/contracts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createContractDraftDocumentUploadUrl: (
    proposalId: string,
    payload: { fileName: string; contentType: string; sizeBytes: number },
  ) =>
    adminFetch<{ url: string; fileUrl: string; key: string }>(
      `/contracts/proposals/${proposalId}/draft-document-upload-url`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  listContracts: () => adminFetch<Contract[]>("/contracts"),
  createContractDocumentUploadUrl: (
    id: string,
    payload: { fileName: string; contentType: string; sizeBytes: number },
  ) =>
    adminFetch<{ url: string; fileUrl: string; key: string }>(`/contracts/${id}/document-upload-url`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateContractStatus: (id: string, status: Contract["status"]) =>
    adminFetch<Contract>(`/contracts/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  listContractVersions: (id: string) =>
    adminFetch<ContractVersion[]>(`/contracts/${id}/versions`),
  getContractDocumentAccessUrl: (id: string) =>
    adminFetch<{ key: string | null; url: string; expiresIn: number | null }>(
      `/contracts/${id}/document-access-url`,
    ),
  createPayment: (payload: {
    projectId: string
    type: Payment["type"]
    amount: number
    dueDate?: string
    notes?: string
  }) =>
    adminFetch<Payment>("/payments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createPaymentOrder: (paymentId: string, receipt?: string) =>
    adminFetch<Payment>("/payments/orders", {
      method: "POST",
      body: JSON.stringify({ paymentId, receipt }),
    }),
  listPayments: (params: URLSearchParams) =>
    adminFetch<PaginatedResponse<Payment>>(`/payments?${params.toString()}`),
  listPaymentHistory: (projectId: string) =>
    adminFetch<Payment[]>(`/payments/project/${projectId}/history`),
  updatePaymentStatus: (
    id: string,
    payload: {
      status: PaymentStatus
      transactionId?: string
    },
  ) =>
    adminFetch<Payment>(`/payments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  refundPayment: (id: string, payload: { amount?: number; reason?: string }) =>
    adminFetch<Payment>(`/payments/${id}/refund`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listProjects: (params: URLSearchParams) =>
    adminFetch<PaginatedResponse<Project>>(`/projects?${params.toString()}`),
  getProject: (id: string) => adminFetch<Project>(`/projects/${id}`),
  listProjectUpdates: (id: string) =>
    adminFetch<ProjectUpdate[]>(`/projects/${id}/updates`),
  createProjectUpdate: (
    id: string,
    payload: {
      stage: ProjectUpdate["stage"]
      title: string
      body?: string
      isInternal?: boolean
    },
  ) =>
    adminFetch<ProjectUpdate>(`/projects/${id}/updates`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listProjectAssignments: (id: string) =>
    adminFetch<StaffAssignment[]>(`/projects/${id}/assignments`),
  updateProject: (
    id: string,
    payload: {
      status?: ProjectStatus
      progress?: number
      summary?: string
    },
  ) =>
    adminFetch<Project>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  assignProjectStaff: (
    id: string,
    payload: { userId: string; role: "PRIMARY" | "SUPPORTING"; notes?: string },
  ) =>
    adminFetch<StaffAssignment>(`/projects/${id}/assignments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  assignVendor: (projectId: string, vendorId: string) =>
    adminFetch(`/projects/${projectId}/vendors/${vendorId}`, {
      method: "POST",
    }),
  listVendors: (params: URLSearchParams) =>
    adminFetch<PaginatedResponse<Vendor>>(`/vendors?${params.toString()}`),
  createVendor: (payload: Record<string, unknown>) =>
    adminFetch<Vendor>("/vendors", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateVendor: (id: string, payload: Record<string, unknown>) =>
    adminFetch<Vendor>(`/vendors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  createStaffUser: (payload: {
    name: string
    phone?: string
    email?: string
    role: Extract<AdminRole, "ADMIN" | "SALES" | "OPS" | "FINANCE">
  }) =>
    adminFetch<AdminUser>("/users/staff", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateUserRole: (
    id: string,
    role: Extract<AdminRole, "ADMIN" | "SALES" | "OPS" | "FINANCE">,
  ) =>
    adminFetch<AdminUser>(`/users/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  updateUserStatus: (id: string, isActive: boolean) =>
    adminFetch<AdminUser>(`/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }),
  listUsers: (params: URLSearchParams) =>
    adminFetch<PaginatedResponse<AdminUser>>(`/users?${params.toString()}`),
  listTeamMembers: () => adminFetch<AdminTeamMember[]>("/team/admin"),
  createTeamMember: (payload: TeamMemberMutationPayload) =>
    adminFetch<AdminTeamMember>("/team", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTeamMember: (id: string, payload: TeamMemberMutationPayload) =>
    adminFetch<AdminTeamMember>(`/team/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteTeamMember: (id: string) =>
    adminFetch<{ success: boolean }>(`/team/${id}`, {
      method: "DELETE",
    }),
  getTeamImageUploadSignature: (payload: {
    fileName?: string
    contentType: string
    sizeBytes: number
  }) =>
    adminFetch<TeamImageUploadSignature>("/team/images/signature", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteTeamImage: (publicId: string) =>
    adminFetch<{ success: boolean }>("/team/images/delete", {
      method: "POST",
      body: JSON.stringify({ publicId }),
    }),
}
