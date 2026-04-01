"use client"

import { resolveBookingService } from "@/components/booking/booking-service-config"
import type {
  AssistantConversationContext,
  AssistantWorkspaceRole,
} from "@/types/assistant"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type SearchParamsLike = {
  get: (name: string) => string | null
  entries: () => IterableIterator<[string, string]>
}

function isUuid(value?: string | null) {
  return Boolean(value && UUID_PATTERN.test(value))
}

function resolveServiceSlug(pathname: string, segments: string[]) {
  if (pathname.startsWith("/booking/") && segments[1]) {
    return resolveBookingService(segments[1])?.slug ?? null
  }

  if (pathname === "/booking") {
    return null
  }

  return resolveBookingService(segments[0])?.slug ?? null
}

function resolveSection(pathname: string, serviceSlug?: string | null) {
  if (serviceSlug && !pathname.startsWith("/booking")) return "service"
  if (pathname.startsWith("/booking")) return "booking"
  if (pathname.includes("/contracts") || pathname === "/terms") return "contracts"
  if (pathname.includes("/payments") || pathname.includes("/receipts")) return "payments"
  if (pathname.includes("/chat") || pathname.includes("/inbox")) return "chat"
  if (pathname.includes("/notifications")) return "notifications"
  if (pathname.includes("/projects")) return "projects"
  if (pathname.includes("/bookings") || pathname.includes("/events")) return "bookings"
  if (pathname.includes("/team")) return "team"
  if (pathname === "/") return "home"
  return "general"
}

function pickPageStateString(pageState: Record<string, unknown> | null | undefined, key: string) {
  return typeof pageState?.[key] === "string" ? pageState[key] : null
}

function pickPageStateObject(pageState: Record<string, unknown> | null | undefined, key: string) {
  const value = pageState?.[key]
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function pickPageStateNumber(pageState: Record<string, unknown> | null | undefined, key: string) {
  return typeof pageState?.[key] === "number" ? pageState[key] : null
}

function pickPageStateStringArray(
  pageState: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = pageState?.[key]
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? (value as string[])
    : null
}

function collectQueryFilters(searchParams?: SearchParamsLike | null) {
  if (!searchParams) {
    return null
  }

  const filters = Object.fromEntries(
    Array.from(searchParams.entries()).filter(([key]) =>
      ["status", "type", "projectId", "leadId", "contractId", "paymentId", "search", "q"].includes(
        key,
      ),
    ),
  )

  return Object.keys(filters).length ? filters : null
}

export function resolveAssistantContext(
  role: AssistantWorkspaceRole,
  pathname: string,
  pageTitle?: string,
  searchParams?: SearchParamsLike | null,
  pageState?: Record<string, unknown> | null,
): AssistantConversationContext {
  const segments = pathname.split("/").filter(Boolean)
  const serviceSlug = resolveServiceSlug(pathname, segments)
  const resolvedService = resolveBookingService(serviceSlug)
  const currentTab =
    pickPageStateString(pageState, "currentTab") ??
    searchParams?.get("tab") ??
    searchParams?.get("panel") ??
    null
  const currentView =
    pickPageStateString(pageState, "currentView") ??
    searchParams?.get("view") ??
    null
  const searchTerm =
    pickPageStateString(pageState, "searchTerm") ??
    searchParams?.get("search") ??
    searchParams?.get("q") ??
    null
  const selectedPaymentId =
    pickPageStateString(pageState, "selectedPaymentId") ??
    searchParams?.get("paymentId") ??
    null
  const selectedContractId =
    pickPageStateString(pageState, "selectedContractId") ??
    searchParams?.get("contractId") ??
    null
  const selectedProjectId =
    pickPageStateString(pageState, "selectedProjectId") ??
    searchParams?.get("projectId") ??
    null
  const selectedBookingId =
    pickPageStateString(pageState, "selectedBookingId") ??
    searchParams?.get("bookingId") ??
    searchParams?.get("leadId") ??
    null
  const context: AssistantConversationContext = {
    pagePath: pathname,
    pageTitle,
    metadata: {
      workspaceRole: role,
      section: resolveSection(pathname, serviceSlug),
      serviceSlug: resolvedService?.slug,
      serviceLabel: resolvedService?.shortLabel,
      currentTab,
      currentView,
      currentRoute: pathname,
      searchTerm,
      selectedPaymentId: isUuid(selectedPaymentId) ? selectedPaymentId : null,
      selectedContractId: isUuid(selectedContractId) ? selectedContractId : null,
      selectedProjectId: isUuid(selectedProjectId) ? selectedProjectId : null,
      selectedBookingId: isUuid(selectedBookingId) ? selectedBookingId : null,
      selectedConversationId:
        typeof pageState?.selectedConversationId === "string"
          ? pageState.selectedConversationId
          : null,
      unreadNotificationCount: pickPageStateNumber(pageState, "unreadNotificationCount"),
      unreadChatCount: pickPageStateNumber(pageState, "unreadChatCount"),
      overduePaymentCount: pickPageStateNumber(pageState, "overduePaymentCount"),
      pendingPaymentCount: pickPageStateNumber(pageState, "pendingPaymentCount"),
      unsignedContractCount: pickPageStateNumber(pageState, "unsignedContractCount"),
      pendingTaskCount: pickPageStateNumber(pageState, "pendingTaskCount"),
      blockedBookingCount: pickPageStateNumber(pageState, "blockedBookingCount"),
      recentActionLabels: pickPageStateStringArray(pageState, "recentActionLabels"),
      recentNotificationTitles: pickPageStateStringArray(pageState, "recentNotificationTitles"),
      filters: pickPageStateObject(pageState, "filters") ?? collectQueryFilters(searchParams),
      pageState: pageState ?? undefined,
    },
  }

  if (role === "client" && segments[1] === "events" && isUuid(segments[2])) {
    context.bookingId = segments[2]
    context.leadId = segments[2]
  }

  if ((role === "admin" || role === "staff") && segments[1] === "bookings" && isUuid(segments[2])) {
    context.bookingId = segments[2]
    context.leadId = segments[2]
  }

  if ((role === "staff" || role === "vendor") && segments[1] === "projects" && isUuid(segments[2])) {
    context.projectId = segments[2]
  }

  if (!context.projectId && isUuid(selectedProjectId)) {
    context.projectId = selectedProjectId ?? undefined
  }

  if (!context.leadId && isUuid(selectedBookingId)) {
    context.leadId = selectedBookingId ?? undefined
    context.bookingId = selectedBookingId ?? undefined
  }

  return context
}
