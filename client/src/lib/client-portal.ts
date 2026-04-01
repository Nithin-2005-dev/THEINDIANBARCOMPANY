import { apiRequest, redirectOnUnauthorized } from "@/lib/api"
import { getRoleLoginPath } from "@/lib/auth-routes"
import type {
  PortalContractVersion,
  PortalConversationType,
  PortalDashboardResponse,
  PortalEventDetailResponse,
  PortalInboxConversation,
  PortalMessage,
  PortalNotification,
  PortalThreadPage,
} from "@/types/client-portal"

export class PortalApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "PortalApiError"
    this.status = status
  }
}

function getClientLoginRedirect() {
  if (typeof window === "undefined") {
    return getRoleLoginPath("CLIENT")
  }

  const nextPath = `${window.location.pathname}${window.location.search}`
  return getRoleLoginPath("CLIENT", nextPath)
}

async function portalRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET"
  const body =
    typeof init?.body === "string" && init.body.length > 0
      ? JSON.parse(init.body)
      : init?.body

  return apiRequest<T>({
    url: path,
    method,
    data: body,
    headers: init?.headers as Record<string, string> | undefined,
  }).catch((error) => {
    const normalizedError = redirectOnUnauthorized(error, getClientLoginRedirect())
    throw new PortalApiError(
      normalizedError.message ?? "We couldn't complete that request right now.",
      normalizedError.status ?? 0,
    )
  })
}

export async function fetchPortalDashboard() {
  return portalRequest<PortalDashboardResponse>("/client/proxy/client-portal/dashboard")
}

export async function fetchPortalEvent(id: string) {
  return portalRequest<PortalEventDetailResponse>(`/client/proxy/client-portal/events/${id}`)
}

export async function fetchPortalNotifications() {
  return portalRequest<PortalNotification[]>("/client/proxy/client-portal/notifications")
}

export async function fetchPortalInbox() {
  return portalRequest<PortalInboxConversation[]>("/client/proxy/client-portal/inbox")
}

function withConversationType(
  path: string,
  conversationType?: PortalConversationType,
) {
  if (!conversationType) return path

  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}conversationType=${conversationType}`
}

export async function sendPortalOtp(payload: {
  identifier: string
  name?: string
}) {
  return portalRequest<{
    challengeId: string
    message: string
    expiresInMinutes: number
    resendAvailableAt?: string
    sentTo?: string
    channel?: "PHONE" | "EMAIL"
  }>("/client/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      roleHint: "CLIENT",
    }),
  })
}

export async function verifyPortalOtp(payload: {
  challengeId: string
  identifier: string
  otp: string
}) {
  return portalRequest<{ user: { id: string } }>("/client/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      expectedRole: "CLIENT",
    }),
  })
}

export async function logoutPortal() {
  return portalRequest<{ success: boolean }>("/client/auth/logout", {
    method: "POST",
  })
}

export async function decideProposal(
  proposalId: string,
  payload: { status: "ACCEPTED" | "REJECTED"; comment?: string },
) {
  return portalRequest(`/client/proxy/proposals/${proposalId}/decision`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function signContract(
  contractId: string,
  payload: { acceptedTerms: boolean; signerName: string },
) {
  return portalRequest(`/client/proxy/contracts/${contractId}/sign`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function getContractDocumentAccessUrl(contractId: string) {
  return portalRequest<{ key: string | null; url: string; expiresIn: number | null }>(
    `/client/proxy/contracts/${contractId}/document-access-url`,
  )
}

export async function listContractVersions(contractId: string) {
  return portalRequest<PortalContractVersion[]>(`/client/proxy/contracts/${contractId}/versions`)
}

export async function sendEventMessage(
  leadId: string,
  payload: { body: string; attachmentName?: string; attachmentKey?: string; attachmentUrl?: string },
  conversationType?: PortalConversationType,
) {
  return portalRequest<PortalMessage>(`/client/proxy/client-portal/events/${leadId}/messages${conversationType ? `?conversationType=${conversationType}` : ""}`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function createEventMessageUploadUrl(
  leadId: string,
  payload: { fileName: string; contentType: string; sizeBytes: number },
  conversationType?: PortalConversationType,
) {
  return portalRequest<{ url: string; fileUrl: string; key: string }>(
    withConversationType(`/client/proxy/client-portal/events/${leadId}/message-upload-url`, conversationType),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  )
}

export async function updateEventTypingStatus(
  leadId: string,
  isTyping: boolean,
  conversationType?: PortalConversationType,
) {
  return portalRequest<{ success: boolean }>(withConversationType(`/client/proxy/client-portal/events/${leadId}/typing`, conversationType), {
    method: "POST",
    body: JSON.stringify({ isTyping }),
  })
}

export async function fetchPortalThread(
  leadId: string,
  conversationType?: PortalConversationType,
) {
  return portalRequest<PortalMessage[]>(
    withConversationType(`/client/proxy/client-portal/events/${leadId}/thread`, conversationType),
  )
}

export async function fetchPortalThreadWindow(
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
) {
  const params = new URLSearchParams()

  if (options?.conversationType) {
    params.set("conversationType", options.conversationType)
  }
  if (options?.limit) {
    params.set("limit", String(options.limit))
  }
  if (options?.beforeCreatedAt) {
    params.set("beforeCreatedAt", options.beforeCreatedAt)
  }
  if (options?.beforeId) {
    params.set("beforeId", options.beforeId)
  }
  if (options?.search?.trim()) {
    params.set("search", options.search.trim())
  }
  if (options?.date) {
    params.set("date", options.date)
  }
  if (options?.hasAttachment) {
    params.set("hasAttachment", "true")
  }

  const query = params.toString()
  return portalRequest<PortalThreadPage>(
    `/client/proxy/client-portal/events/${leadId}/thread-window${query ? `?${query}` : ""}`,
  )
}

export async function submitEventFeedback(
  projectId: string,
  payload: {
    rating: number
    testimonial?: string
    comments?: string
    allowMediaUsage: boolean
  },
) {
  return portalRequest(`/client/proxy/client-portal/projects/${projectId}/feedback`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function markNotificationRead(notificationId: string) {
  return portalRequest(`/client/proxy/client-portal/notifications/${notificationId}/read`, {
    method: "PATCH",
  })
}

export async function createPaymentOrder(paymentId: string) {
  return portalRequest<{
    id: string
    amount: number
    currency: string
    gatewayOrderId?: string | null
  } & Record<string, unknown>>("/client/proxy/payments/orders", {
    method: "POST",
    body: JSON.stringify({ paymentId }),
  })
}

export async function verifyPayment(payload: {
  paymentId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}) {
  return portalRequest("/client/proxy/payments/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
