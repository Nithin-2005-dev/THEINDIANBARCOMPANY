import { cookies } from "next/headers"
import { getBackendApiUrl as getSharedBackendApiUrl } from "@/lib/admin-auth"

export const STAFF_ACCESS_COOKIE = "tib_staff_access"
export const STAFF_REFRESH_COOKIE = "tib_staff_refresh"
export const STAFF_SESSION_COOKIE = "tib_staff_session"
export const STAFF_DEVICE_COOKIE = "tib_staff_device"

const ACCESS_MAX_AGE = 60 * 60 * 6
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30

export function getBackendApiUrl() {
  return getSharedBackendApiUrl()
}

export async function getStaffCookieStore() {
  return cookies()
}

export function generateStaffDeviceFingerprint() {
  return `staff-web-${crypto.randomUUID()}`
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

export async function setStaffSessionCookies(payload: {
  accessToken: string
  refreshToken: string
  sessionId?: string
  deviceFingerprint: string
}) {
  const store = await getStaffCookieStore()

  store.set(STAFF_ACCESS_COOKIE, payload.accessToken, buildCookieOptions(ACCESS_MAX_AGE))
  store.set(STAFF_REFRESH_COOKIE, payload.refreshToken, buildCookieOptions(REFRESH_MAX_AGE))
  store.set(STAFF_DEVICE_COOKIE, payload.deviceFingerprint, buildCookieOptions(REFRESH_MAX_AGE))

  if (payload.sessionId) {
    store.set(STAFF_SESSION_COOKIE, payload.sessionId, buildCookieOptions(REFRESH_MAX_AGE))
  }
}

export async function clearStaffSessionCookies() {
  const store = await getStaffCookieStore()
  for (const key of [
    STAFF_ACCESS_COOKIE,
    STAFF_REFRESH_COOKIE,
    STAFF_SESSION_COOKIE,
    STAFF_DEVICE_COOKIE,
  ]) {
    store.delete(key)
  }
}

export async function getStaffSession() {
  const store = await getStaffCookieStore()
  return {
    accessToken: store.get(STAFF_ACCESS_COOKIE)?.value,
    refreshToken: store.get(STAFF_REFRESH_COOKIE)?.value,
    sessionId: store.get(STAFF_SESSION_COOKIE)?.value,
    deviceFingerprint: store.get(STAFF_DEVICE_COOKIE)?.value,
  }
}
