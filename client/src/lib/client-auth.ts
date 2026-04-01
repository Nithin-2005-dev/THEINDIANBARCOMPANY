import { cookies } from "next/headers"
import { getBackendApiUrlFromEnv } from "@/lib/backend-api-url"

export const CLIENT_ACCESS_COOKIE = "tib_client_access"
export const CLIENT_REFRESH_COOKIE = "tib_client_refresh"
export const CLIENT_SESSION_COOKIE = "tib_client_session"
export const CLIENT_DEVICE_COOKIE = "tib_client_device"

const ACCESS_MAX_AGE = 60 * 60 * 6
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30

export function getBackendApiUrl() {
  return getBackendApiUrlFromEnv()
}

export async function getClientCookieStore() {
  return cookies()
}

export function generateClientDeviceFingerprint() {
  return `client-web-${crypto.randomUUID()}`
}

export function buildCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}

export async function setClientSessionCookies(payload: {
  accessToken: string
  refreshToken: string
  sessionId?: string
  deviceFingerprint: string
}) {
  const store = await getClientCookieStore()

  store.set(CLIENT_ACCESS_COOKIE, payload.accessToken, buildCookieOptions(ACCESS_MAX_AGE))
  store.set(CLIENT_REFRESH_COOKIE, payload.refreshToken, buildCookieOptions(REFRESH_MAX_AGE))
  store.set(CLIENT_DEVICE_COOKIE, payload.deviceFingerprint, buildCookieOptions(REFRESH_MAX_AGE))

  if (payload.sessionId) {
    store.set(CLIENT_SESSION_COOKIE, payload.sessionId, buildCookieOptions(REFRESH_MAX_AGE))
  }
}

export async function clearClientSessionCookies() {
  const store = await getClientCookieStore()

  for (const key of [
    CLIENT_ACCESS_COOKIE,
    CLIENT_REFRESH_COOKIE,
    CLIENT_SESSION_COOKIE,
    CLIENT_DEVICE_COOKIE,
  ]) {
    store.delete(key)
  }
}

export async function getClientSession() {
  const store = await getClientCookieStore()
  return {
    accessToken: store.get(CLIENT_ACCESS_COOKIE)?.value,
    refreshToken: store.get(CLIENT_REFRESH_COOKIE)?.value,
    sessionId: store.get(CLIENT_SESSION_COOKIE)?.value,
    deviceFingerprint: store.get(CLIENT_DEVICE_COOKIE)?.value,
  }
}
