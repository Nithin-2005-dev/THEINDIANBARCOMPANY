import { cookies } from "next/headers"
import { getBackendApiUrlFromEnv } from "@/lib/backend-api-url"

export const ADMIN_ACCESS_COOKIE = "tib_admin_access"
export const ADMIN_REFRESH_COOKIE = "tib_admin_refresh"
export const ADMIN_SESSION_COOKIE = "tib_admin_session"
export const ADMIN_DEVICE_COOKIE = "tib_admin_device"

const ACCESS_MAX_AGE = 60 * 60 * 6
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30

export function getBackendApiUrl() {
  return getBackendApiUrlFromEnv()
}

export async function getAdminCookieStore() {
  return cookies()
}

export function generateDeviceFingerprint() {
  return `admin-web-${crypto.randomUUID()}`
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

export async function setAdminSessionCookies(payload: {
  accessToken: string
  refreshToken: string
  sessionId?: string
  deviceFingerprint: string
}) {
  const store = await getAdminCookieStore()

  store.set(ADMIN_ACCESS_COOKIE, payload.accessToken, buildCookieOptions(ACCESS_MAX_AGE))
  store.set(ADMIN_REFRESH_COOKIE, payload.refreshToken, buildCookieOptions(REFRESH_MAX_AGE))
  store.set(ADMIN_DEVICE_COOKIE, payload.deviceFingerprint, buildCookieOptions(REFRESH_MAX_AGE))

  if (payload.sessionId) {
    store.set(ADMIN_SESSION_COOKIE, payload.sessionId, buildCookieOptions(REFRESH_MAX_AGE))
  }
}

export async function clearAdminSessionCookies() {
  const store = await getAdminCookieStore()
  for (const key of [
    ADMIN_ACCESS_COOKIE,
    ADMIN_REFRESH_COOKIE,
    ADMIN_SESSION_COOKIE,
    ADMIN_DEVICE_COOKIE,
  ]) {
    store.delete(key)
  }
}

export async function getAdminSession() {
  const store = await getAdminCookieStore()
  return {
    accessToken: store.get(ADMIN_ACCESS_COOKIE)?.value,
    refreshToken: store.get(ADMIN_REFRESH_COOKIE)?.value,
    sessionId: store.get(ADMIN_SESSION_COOKIE)?.value,
    deviceFingerprint: store.get(ADMIN_DEVICE_COOKIE)?.value,
  }
}
