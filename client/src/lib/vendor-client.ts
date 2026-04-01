"use client"

import { apiRequest, redirectOnUnauthorized } from "@/lib/api"
import { getRoleLoginPath } from "@/lib/auth-routes"
import type { PortalConversationType, PortalMessage } from "@/types/client-portal"
import type { StaffTask } from "@/types/staff"
import type { VendorDashboardResponse, VendorProjectResponse } from "@/types/vendor"

export class VendorApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "VendorApiError"
    this.status = status
  }
}

function getVendorLoginRedirect() {
  if (typeof window === "undefined") {
    return getRoleLoginPath("VENDOR")
  }

  const nextPath = `${window.location.pathname}${window.location.search}`
  return getRoleLoginPath("VENDOR", nextPath)
}

async function vendorFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET"
  const body =
    typeof init?.body === "string" && init.body.length > 0
      ? JSON.parse(init.body)
      : init?.body

  return apiRequest<T>({
    url: `/vendor/proxy${path}`,
    method,
    data: body,
    headers: init?.headers as Record<string, string> | undefined,
  }).catch((error) => {
    const normalizedError = redirectOnUnauthorized(error, getVendorLoginRedirect())
    throw new VendorApiError(normalizedError.message ?? "Request failed.", normalizedError.status ?? 0)
  })
}

function withConversationType(path: string, conversationType: PortalConversationType = "DIRECT_VENDOR") {
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}conversationType=${conversationType}`
}

export const vendorApi = {
  me: () =>
    apiRequest<unknown>({
      url: "/vendor/auth/me",
    }).catch((error) => {
      const normalizedError = redirectOnUnauthorized(error, getVendorLoginRedirect())
      throw new VendorApiError(normalizedError.message ?? "Unauthorized", normalizedError.status ?? 0)
    }),
  dashboard: () => vendorFetch<VendorDashboardResponse>("/vendor-portal/dashboard"),
  getProject: (id: string) => vendorFetch<VendorProjectResponse>(`/vendor-portal/projects/${id}`),
  createStatusUpdate: (id: string, payload: { stage?: string; title?: string; body?: string }) =>
    vendorFetch(`/vendor-portal/projects/${id}/status`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  notifications: () => vendorFetch("/vendor-portal/notifications"),
  markNotificationRead: (id: string) =>
    vendorFetch(`/vendor-portal/notifications/${id}/read`, { method: "PATCH" }),
  listProjectTasks: (id: string) => vendorFetch<StaffTask[]>(`/projects/${id}/tasks`),
  updateProjectTask: (projectId: string, taskId: string, payload: Record<string, unknown>) =>
    vendorFetch<StaffTask>(`/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  addTaskComment: (projectId: string, taskId: string, body: string) =>
    vendorFetch(`/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  createTaskAttachmentUploadUrl: (projectId: string, taskId: string, payload: { fileName: string; contentType: string; sizeBytes: number }) =>
    vendorFetch<{ url: string; fileUrl: string }>(`/projects/${projectId}/tasks/${taskId}/attachment-upload-url`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createProjectDocumentUploadUrl: (projectId: string, payload: { fileName: string; contentType: string; sizeBytes: number; category?: string }) =>
    vendorFetch<{ url: string; fileUrl: string }>(`/projects/${projectId}/document-upload-url`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getThread: (leadId: string, conversationType: PortalConversationType = "DIRECT_VENDOR") =>
    vendorFetch<PortalMessage[]>(withConversationType(`/client-portal/events/${leadId}/thread`, conversationType)),
  sendMessage: (leadId: string, payload: { body: string; attachmentName?: string; attachmentKey?: string; attachmentUrl?: string }, conversationType: PortalConversationType = "DIRECT_VENDOR") =>
    vendorFetch<PortalMessage>(withConversationType(`/client-portal/events/${leadId}/messages`, conversationType), {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createMessageUploadUrl: (leadId: string, payload: { fileName: string; contentType: string; sizeBytes: number }, conversationType: PortalConversationType = "DIRECT_VENDOR") =>
    vendorFetch<{ url: string; fileUrl: string; key: string }>(withConversationType(`/client-portal/events/${leadId}/message-upload-url`, conversationType), {
      method: "POST",
      body: JSON.stringify(payload),
    }),
}
