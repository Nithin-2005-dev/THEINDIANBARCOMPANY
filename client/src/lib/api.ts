"use client"

import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  isAxiosError,
} from "axios"
import type { CreateLeadPayload, LeadResponse } from "@/types/leads"

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_RETRY_COUNT = 2
const DEFAULT_RETRY_DELAY_MS = 350
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])
const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

type ApiFetchOptions = {
  timeoutMs?: number
  authToken?: string
  headers?: Record<string, string>
}

type RetryableApiRequestConfig = AxiosRequestConfig & {
  __retryCount?: number
  __retryDelayMs?: number
}

type ToastApi = {
  pushToast: (input: {
    title: string
    description?: string
    tone?: "default" | "success" | "error"
  }) => void
}

type ErrorPayload = {
  error?: {
    message?: string
  }
  message?: string
  requestId?: string
}

const STATUS_MESSAGE_MAP: Record<number, string> = {
  400: "Invalid input. Please review the form and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "Access denied. You do not have permission to perform this action.",
  404: "The requested resource could not be found.",
  408: "The request timed out. Please try again.",
  409: "This request conflicts with the current record state.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "Server error. Please try again shortly.",
}

export class ApiError extends Error {
  status: number
  details?: unknown
  code?: string
  requestId?: string
  isNetworkError: boolean

  constructor({
    message,
    status,
    details,
    code,
    requestId,
    isNetworkError = false,
  }: {
    message: string
    status: number
    details?: unknown
    code?: string
    requestId?: string
    isNetworkError?: boolean
  }) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.details = details
    this.code = code
    this.requestId = requestId
    this.isNetworkError = isNetworkError
  }
}

function wait(durationMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs)
  })
}

function buildRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function extractPayloadMessage(data: unknown) {
  if (!data || typeof data !== "object") {
    return undefined
  }

  const payload = data as ErrorPayload
  return payload.error?.message || payload.message
}

export function getFriendlyStatusMessage(status?: number) {
  if (!status) {
    return "We could not reach the server. Please check your connection and try again."
  }

  if (STATUS_MESSAGE_MAP[status]) {
    return STATUS_MESSAGE_MAP[status]
  }

  if (status >= 500) {
    return STATUS_MESSAGE_MAP[500]
  }

  return "Something went wrong. Please try again."
}

export function normalizeApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error
  }

  if (!isAxiosError(error)) {
    return new ApiError({
      message: getFriendlyStatusMessage(),
      status: 0,
      details: error,
      code: "UNKNOWN_ERROR",
      isNetworkError: true,
    })
  }

  const responseData = error.response?.data
  const requestId =
    error.response?.headers?.["x-request-id"] ??
    (typeof responseData === "object" && responseData
      ? (responseData as ErrorPayload).requestId
      : undefined)

  const status = error.response?.status ?? 0
  const message =
    extractPayloadMessage(responseData) ||
    (error.code === "ECONNABORTED"
      ? "The request took too long. Please try again."
      : undefined) ||
    error.message ||
    getFriendlyStatusMessage(status)

  return new ApiError({
    message,
    status,
    details: responseData,
    code: error.code,
    requestId,
    isNetworkError: !error.response,
  })
}

function shouldRetry(error: AxiosError, config?: RetryableApiRequestConfig) {
  const method = (config?.method ?? "GET").toUpperCase()

  if (!RETRYABLE_METHODS.has(method)) {
    return false
  }

  if (error.code === "ECONNABORTED" || !error.response) {
    return true
  }

  return RETRYABLE_STATUS_CODES.has(error.response.status)
}

export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
})

api.interceptors.request.use((config) => {
  const nextConfig = { ...config }
  const headers = axios.AxiosHeaders.from(nextConfig.headers)

  if (!headers.has("x-request-id")) {
    headers.set("x-request-id", buildRequestId())
  }

  nextConfig.headers = headers
  return nextConfig
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableApiRequestConfig | undefined
    const retryCount = config?.__retryCount ?? 0

    if (config && retryCount < DEFAULT_RETRY_COUNT && shouldRetry(error, config)) {
      config.__retryCount = retryCount + 1
      await wait((config.__retryDelayMs ?? DEFAULT_RETRY_DELAY_MS) * config.__retryCount)
      return api.request(config)
    }

    return Promise.reject(normalizeApiError(error))
  },
)

export async function apiRequest<T>(config: AxiosRequestConfig) {
  const response = await api.request<T>(config)
  return response.data
}

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong.") {
  return normalizeApiError(error).message || fallback
}

export function getApiErrorDescription(error: unknown) {
  const normalizedError = normalizeApiError(error)
  const friendlyMessage = getFriendlyStatusMessage(normalizedError.status)

  if (friendlyMessage === normalizedError.message) {
    return normalizedError.requestId
      ? `Request ID: ${normalizedError.requestId}`
      : undefined
  }

  return normalizedError.requestId
    ? `${friendlyMessage} Request ID: ${normalizedError.requestId}`
    : friendlyMessage
}

export function showApiErrorToast(
  toast: ToastApi,
  error: unknown,
  title = "Request failed",
) {
  toast.pushToast({
    title,
    description: getApiErrorDescription(error) ?? getApiErrorMessage(error),
    tone: "error",
  })
}

export function redirectOnUnauthorized(error: unknown, redirectTo: string) {
  const normalizedError = normalizeApiError(error)

  if (normalizedError.status === 401 && typeof window !== "undefined") {
    window.location.href = redirectTo
  }

  return normalizedError
}

function buildOperationalNotes(payload: CreateLeadPayload) {
  const operationalHeader = [
    `Lead contact name: ${payload.name}`,
    `Primary phone: ${payload.phone}`,
    payload.email ? `Email: ${payload.email}` : "",
    `Preferred contact: ${payload.preferredContact}`,
  ]
    .filter(Boolean)
    .join("\n")

  return [operationalHeader, payload.notes?.trim() || ""].filter(Boolean).join("\n\n")
}

function toPublicBookingRequest(payload: CreateLeadPayload) {
  return {
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    eventType: payload.eventType,
    location: payload.location,
    city: payload.city,
    packageName: payload.packageName,
    packageLabel: payload.packageLabel,
    addOns: payload.addOns,
    eventDate: payload.eventDate,
    guestCount: payload.guestCount,
    budgetMin: payload.budgetMin,
    budgetMax: payload.budgetMax,
    notes: buildOperationalNotes(payload),
  }
}

export async function requestJson<T>(
  path: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  return apiRequest<T>({
    url: path,
    ...config,
  })
}

export async function createLead(
  payload: CreateLeadPayload,
  options: ApiFetchOptions = {},
) {
  return apiRequest<LeadResponse>({
    url: "/booking",
    method: "POST",
    data: toPublicBookingRequest(payload),
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    headers: {
      ...(options.authToken ? { Authorization: `Bearer ${options.authToken}` } : {}),
      ...(options.headers ?? {}),
    },
  })
}

export type ApiResponse<T> = AxiosResponse<T>
