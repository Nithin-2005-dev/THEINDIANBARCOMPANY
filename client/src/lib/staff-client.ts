"use client"

import { apiRequest, normalizeApiError, redirectOnUnauthorized } from "@/lib/api"
import { getRoleLoginPath } from "@/lib/auth-routes"
import type { PortalConversationType, PortalMessage, PortalThreadPage } from "@/types/client-portal"
import type { Lead, LeadStatus, Payment, Project, Proposal } from "@/types/admin"
import type {
  StaffDashboardResponse,
  StaffInboxThread,
  StaffNotification,
  StaffProjectDocument,
  StaffProjectUpdate,
  StaffTask,
} from "@/types/staff"
import type { AdminUser } from "@/types/admin"

export class StaffApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "StaffApiError"
    this.status = status
  }
}

function getStaffLoginRedirect() {
  if (typeof window === "undefined") {
    return getRoleLoginPath("STAFF")
  }

  const nextPath = `${window.location.pathname}${window.location.search}`
  return getRoleLoginPath("STAFF", nextPath)
}

async function staffFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET"
  const body =
    typeof init?.body === "string" && init.body.length > 0
      ? JSON.parse(init.body)
      : init?.body

  return apiRequest<T>({
    url: `/staff/proxy${path}`,
    method,
    data: body,
    headers: init?.headers as Record<string, string> | undefined,
  }).catch((error) => {
    const normalizedError = redirectOnUnauthorized(error, getStaffLoginRedirect())
    throw new StaffApiError(normalizedError.message ?? "Request failed.", normalizedError.status ?? 0)
  })
}

function withConversationType(path: string, conversationType?: PortalConversationType) {
  if (!conversationType) return path

  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}conversationType=${conversationType}`
}

export const staffApi = {
  me: () =>
    apiRequest<AdminUser>({
      url: "/staff/auth/me",
    }).catch((error) => {
      const normalizedError = normalizeApiError(
        redirectOnUnauthorized(error, getStaffLoginRedirect()),
      )
      throw new StaffApiError(normalizedError.message ?? "Unauthorized", normalizedError.status)
    }),
  dashboard: () => staffFetch<StaffDashboardResponse>("/staff/dashboard"),
  inbox: () => staffFetch<StaffInboxThread[]>("/staff/inbox"),
  notifications: () => staffFetch<StaffNotification[]>("/staff/notifications"),
  markNotificationRead: (id: string) =>
    staffFetch(`/staff/notifications/${id}/read`, { method: "PATCH" }),
  listLeads: (params: URLSearchParams) => staffFetch<{ items: Lead[]; meta: { page: number; limit: number; total: number } }>(`/leads?${params.toString()}`),
  getLead: (id: string) => staffFetch<Lead>(`/leads/${id}`),
  updateLeadStatus: (id: string, status: LeadStatus) =>
    staffFetch<Lead>(`/leads/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  createLeadNote: (id: string, content: string) =>
    staffFetch(`/leads/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  addLeadActivity: (id: string, description: string) =>
    staffFetch(`/leads/${id}/timeline/manual`, {
      method: "POST",
      body: JSON.stringify({ description }),
    }),
  listProjects: (params: URLSearchParams) => staffFetch<{ items: Project[]; meta: { page: number; limit: number; total: number } }>(`/projects?${params.toString()}`),
  getProject: (id: string) => staffFetch<Project>(`/projects/${id}`),
  listProjectUpdates: (id: string) => staffFetch<StaffProjectUpdate[]>(`/projects/${id}/updates`),
  createProjectUpdate: (id: string, payload: { title: string; body?: string; stage: string; isInternal?: boolean }) =>
    staffFetch(`/projects/${id}/updates`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listProjectTasks: (id: string) => staffFetch<StaffTask[]>(`/projects/${id}/tasks`),
  createProjectTask: (id: string, payload: Record<string, unknown>) =>
    staffFetch<StaffTask>(`/projects/${id}/tasks`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProjectTask: (projectId: string, taskId: string, payload: Record<string, unknown>) =>
    staffFetch<StaffTask>(`/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  addTaskComment: (projectId: string, taskId: string, body: string) =>
    staffFetch(`/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  createTaskAttachmentUploadUrl: (projectId: string, taskId: string, payload: { fileName: string; contentType: string; sizeBytes: number }) =>
    staffFetch<{ url: string; fileUrl: string }>(`/projects/${projectId}/tasks/${taskId}/attachment-upload-url`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listProjectDocuments: (projectId: string) =>
    staffFetch<StaffProjectDocument[]>(`/projects/${projectId}/documents`),
  createProjectDocumentUploadUrl: (projectId: string, payload: { fileName: string; contentType: string; sizeBytes: number; category?: string }) =>
    staffFetch<{ url: string; fileUrl: string }>(`/projects/${projectId}/document-upload-url`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getThread: (leadId: string, conversationType?: PortalConversationType) =>
    staffFetch<PortalMessage[]>(withConversationType(`/client-portal/events/${leadId}/thread`, conversationType)),
  getThreadWindow: (
    leadId: string,
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

    return staffFetch<PortalThreadPage>(`/client-portal/events/${leadId}/thread-window${query ? `?${query}` : ""}`)
  },
  sendMessage: (leadId: string, payload: { body: string; attachmentName?: string; attachmentKey?: string; attachmentUrl?: string }, conversationType?: PortalConversationType) =>
    staffFetch<PortalMessage>(withConversationType(`/client-portal/events/${leadId}/messages`, conversationType), {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createMessageUploadUrl: (leadId: string, payload: { fileName: string; contentType: string; sizeBytes: number }, conversationType?: PortalConversationType) =>
    staffFetch<{ url: string; fileUrl: string; key: string }>(withConversationType(`/client-portal/events/${leadId}/message-upload-url`, conversationType), {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTypingStatus: (leadId: string, isTyping: boolean, conversationType?: PortalConversationType) =>
    staffFetch<{ success: boolean }>(withConversationType(`/client-portal/events/${leadId}/typing`, conversationType), {
      method: "POST",
      body: JSON.stringify({ isTyping }),
    }),
  listPayments: (params: URLSearchParams) => staffFetch<{ items: Payment[]; meta: { page: number; limit: number; total: number } }>(`/payments?${params.toString()}`),
  refundPayment: (id: string, payload: { amount?: number; reason?: string }) =>
    staffFetch(`/payments/${id}/refund`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createProposal: (payload: { leadId: string; title: string; price: number; scope: string; deliverables: string; timeline: string; notes?: string }) =>
    staffFetch<Proposal>("/proposals", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
}
