"use client"

import { apiRequest } from "@/lib/api"
import { publicAssistantClient } from "@/lib/public-assistant"
import type {
  AssistantAnalyticsEvent,
  AssistantConversation,
  AssistantConversationContext,
  AssistantLiveTurnResponse,
  AssistantMessage,
  AssistantPromptSuggestion,
  AssistantTurnResponse,
  AssistantWorkspaceRole,
} from "@/types/assistant"

type SseHandlers = {
  onTurn?: (payload: Pick<AssistantTurnResponse, "conversation" | "userMessage">) => void
  onChunk?: (delta: string) => void
  onComplete?: (payload: AssistantTurnResponse) => void
}

type LiveSseHandlers = {
  onTurn?: (payload: Pick<AssistantLiveTurnResponse, "userMessage">) => void
  onChunk?: (delta: string) => void
  onComplete?: (payload: AssistantLiveTurnResponse) => void
}

function getAssistantBasePath(role: AssistantWorkspaceRole) {
  if (role === "public") {
    return null
  }

  switch (role) {
    case "admin":
      return "/admin/proxy/assistant"
    case "staff":
      return "/staff/proxy/assistant"
    case "vendor":
      return "/vendor/proxy/assistant"
    default:
      return "/client/proxy/assistant"
  }
}

async function assistantRequest<T>(
  role: AssistantWorkspaceRole,
  path: string,
  options?: {
    method?: "GET" | "POST" | "PATCH" | "DELETE"
    body?: unknown
  },
) {
  const basePath = getAssistantBasePath(role)
  if (!basePath) {
    throw new Error("Public assistant requests are handled locally.")
  }

  return apiRequest<T>({
    url: `${basePath}${path}`,
    method: options?.method ?? "GET",
    data: options?.body,
  })
}

export const assistantClient = {
  listConversations: (
    role: AssistantWorkspaceRole,
    options?: { search?: string; archived?: boolean } | string,
  ) => {
    const resolvedOptions =
      typeof options === "string" ? { search: options } : options

    if (role === "public") {
      return publicAssistantClient.listConversations(resolvedOptions)
    }

    const params = new URLSearchParams()
    if (resolvedOptions?.search?.trim()) {
      params.set("search", resolvedOptions.search.trim())
    }
    if (resolvedOptions?.archived) {
      params.set("archived", "true")
    }

    return assistantRequest<AssistantConversation[]>(
      role,
      `/conversations${params.toString() ? `?${params.toString()}` : ""}`,
    )
  },
  createConversation: (
    role: AssistantWorkspaceRole,
    payload?: { title?: string; context?: AssistantConversationContext },
  ) => {
    if (role === "public") {
      return publicAssistantClient.createConversation(payload)
    }

    return assistantRequest<AssistantConversation>(role, "/conversations", { method: "POST", body: payload })
  },
  getMessages: (role: AssistantWorkspaceRole, conversationId: string) => {
    if (role === "public") {
      return publicAssistantClient.getMessages(conversationId)
    }

    return assistantRequest<AssistantMessage[]>(role, `/conversations/${conversationId}/messages`)
  },
  renameConversation: (role: AssistantWorkspaceRole, conversationId: string, title: string) => {
    if (role === "public") {
      return publicAssistantClient.renameConversation(conversationId, title)
    }

    return assistantRequest<AssistantConversation>(role, `/conversations/${conversationId}`, {
      method: "PATCH",
      body: { title },
    })
  },
  archiveConversation: (
    role: AssistantWorkspaceRole,
    conversationId: string,
    isArchived: boolean,
  ) => {
    if (role === "public") {
      return publicAssistantClient.archiveConversation(conversationId, isArchived)
    }

    return assistantRequest<AssistantConversation>(role, `/conversations/${conversationId}`, {
      method: "PATCH",
      body: { isArchived },
    })
  },
  pinConversation: (
    role: AssistantWorkspaceRole,
    conversationId: string,
    isPinned: boolean,
  ) => {
    if (role === "public") {
      return publicAssistantClient.pinConversation(conversationId, isPinned)
    }

    return assistantRequest<AssistantConversation>(role, `/conversations/${conversationId}`, {
      method: "PATCH",
      body: { isPinned },
    })
  },
  deleteConversation: (role: AssistantWorkspaceRole, conversationId: string) => {
    if (role === "public") {
      return publicAssistantClient.deleteConversation(conversationId)
    }

    return assistantRequest<{ success: boolean }>(role, `/conversations/${conversationId}`, {
      method: "DELETE",
    })
  },
  trackEvent: (role: AssistantWorkspaceRole, payload: AssistantAnalyticsEvent) => {
    if (role === "public") {
      return publicAssistantClient.trackEvent(payload)
    }

    return assistantRequest<{ success: boolean }>(role, "/events", {
      method: "POST",
      body: payload,
    })
  },
  getSuggestions: (
    role: AssistantWorkspaceRole,
    context: AssistantConversationContext,
  ) => {
    if (role === "public") {
      return publicAssistantClient.getSuggestions(context)
    }

    const params = new URLSearchParams()
    if (context.pagePath) params.set("pagePath", context.pagePath)
    if (context.pageTitle) params.set("pageTitle", context.pageTitle)
    if (context.bookingId) params.set("bookingId", context.bookingId)
    if (context.leadId) params.set("leadId", context.leadId)
    if (context.projectId) params.set("projectId", context.projectId)
    return assistantRequest<AssistantPromptSuggestion[]>(
      role,
      `/suggestions${params.toString() ? `?${params.toString()}` : ""}`,
    )
  },
  sendMessage: (
    role: AssistantWorkspaceRole,
    conversationId: string,
    payload: { content: string; context?: AssistantConversationContext },
  ) => {
    if (role === "public") {
      return publicAssistantClient.sendMessage(conversationId, payload)
    }

    return assistantRequest<AssistantTurnResponse>(role, `/conversations/${conversationId}/messages`, {
      method: "POST",
      body: payload,
    })
  },
  sendLiveMessage: (
    role: AssistantWorkspaceRole,
    payload: { content: string; context?: AssistantConversationContext },
  ) => {
    if (role === "public") {
      return publicAssistantClient.sendLiveMessage(payload)
    }

    return assistantRequest<AssistantLiveTurnResponse>(role, "/chat", {
      method: "POST",
      body: payload,
    })
  },
  streamMessage: async (
    role: AssistantWorkspaceRole,
    conversationId: string,
    payload: { content: string; context?: AssistantConversationContext },
    handlers?: SseHandlers,
  ) => {
    if (role === "public") {
      await publicAssistantClient.streamMessage(conversationId, payload, handlers)
      return
    }

    const basePath = getAssistantBasePath(role)
    if (!basePath) {
      throw new Error("Assistant streaming request failed.")
    }

    const response = await fetch(`/api/v1${basePath}/conversations/${conversationId}/messages/stream`, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    })

    if (!response.ok || !response.body) {
      throw new Error("Assistant streaming request failed.")
    }

    const decoder = new TextDecoder()
    const reader = response.body.getReader()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const parts = buffer.split("\n\n")
      buffer = parts.pop() ?? ""

      for (const part of parts) {
        const event = parseSseEvent(part)
        if (!event?.data) continue

        if (event.type === "turn") {
          handlers?.onTurn?.(JSON.parse(event.data) as Pick<AssistantTurnResponse, "conversation" | "userMessage">)
        }

        if (event.type === "chunk") {
          const payload = JSON.parse(event.data) as { delta: string }
          handlers?.onChunk?.(payload.delta)
        }

        if (event.type === "complete") {
          handlers?.onComplete?.(JSON.parse(event.data) as AssistantTurnResponse)
        }
      }
    }
  },
  streamLiveMessage: async (
    role: AssistantWorkspaceRole,
    payload: { content: string; context?: AssistantConversationContext },
    handlers?: LiveSseHandlers,
  ) => {
    if (role === "public") {
      await publicAssistantClient.streamLiveMessage(payload, handlers)
      return
    }

    const basePath = getAssistantBasePath(role)
    if (!basePath) {
      throw new Error("Assistant streaming request failed.")
    }

    const response = await fetch(`/api/v1${basePath}/chat/stream`, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    })

    if (!response.ok || !response.body) {
      throw new Error("Assistant streaming request failed.")
    }

    const decoder = new TextDecoder()
    const reader = response.body.getReader()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const parts = buffer.split("\n\n")
      buffer = parts.pop() ?? ""

      for (const part of parts) {
        const event = parseSseEvent(part)
        if (!event?.data) continue

        if (event.type === "turn") {
          handlers?.onTurn?.(JSON.parse(event.data) as Pick<AssistantLiveTurnResponse, "userMessage">)
        }

        if (event.type === "chunk") {
          const chunkPayload = JSON.parse(event.data) as { delta: string }
          handlers?.onChunk?.(chunkPayload.delta)
        }

        if (event.type === "complete") {
          handlers?.onComplete?.(JSON.parse(event.data) as AssistantLiveTurnResponse)
        }
      }
    }
  },
}

function parseSseEvent(packet: string) {
  const lines = packet.split("\n")
  const type = lines.find((line) => line.startsWith("event:"))?.replace("event:", "").trim()
  const data = lines.find((line) => line.startsWith("data:"))?.replace("data:", "").trim()

  if (!type || !data) return null

  return { type, data }
}
