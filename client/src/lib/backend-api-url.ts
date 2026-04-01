const API_V1_SUFFIX = "/api/v1"

export function normalizeBackendApiUrl(baseUrl: string) {
  const trimmedBaseUrl = baseUrl.replace(/\/$/, "")

  if (/\/api\/v\d+$/.test(trimmedBaseUrl)) {
    return trimmedBaseUrl
  }

  if (trimmedBaseUrl.endsWith("/api")) {
    return `${trimmedBaseUrl}/v1`
  }

  return `${trimmedBaseUrl}${API_V1_SUFFIX}`
}

export function getBackendApiUrlFromEnv() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL

  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.")
  }

  return normalizeBackendApiUrl(baseUrl)
}
