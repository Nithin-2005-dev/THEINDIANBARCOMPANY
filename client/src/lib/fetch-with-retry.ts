"use client"

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])

function wait(durationMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs)
  })
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: {
    retries?: number
    baseDelayMs?: number
  },
) {
  const retries = options?.retries ?? 2
  const baseDelayMs = options?.baseDelayMs ?? 350
  const method = (init?.method ?? "GET").toUpperCase()
  const allowRetry = method === "GET" || method === "HEAD"

  let attempt = 0
  let lastError: unknown = null

  while (attempt <= retries) {
    try {
      const response = await fetch(input, init)

      if (!allowRetry || !RETRYABLE_STATUS_CODES.has(response.status) || attempt === retries) {
        return response
      }
    } catch (error) {
      lastError = error

      if (!allowRetry || attempt === retries) {
        throw error
      }
    }

    attempt += 1
    await wait(baseDelayMs * attempt)
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed.")
}
