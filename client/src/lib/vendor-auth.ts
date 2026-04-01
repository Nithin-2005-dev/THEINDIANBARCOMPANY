import { cookies } from "next/headers"
import { getBackendApiUrl as getSharedBackendApiUrl } from "@/lib/admin-auth"

export const VENDOR_ACCESS_COOKIE = "tib_vendor_access"
export const VENDOR_REFRESH_COOKIE = "tib_vendor_refresh"
export const VENDOR_SESSION_COOKIE = "tib_vendor_session"
export const VENDOR_DEVICE_COOKIE = "tib_vendor_device"

const ACCESS_MAX_AGE = 60 * 60 * 6
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30

export function getBackendApiUrl() {
  return getSharedBackendApiUrl()
}

export async function getVendorCookieStore() {
  return cookies()
}

export function generateVendorDeviceFingerprint() {
  return `vendor-web-${crypto.randomUUID()}`
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

export async function setVendorSessionCookies(payload: {
  accessToken: string
  refreshToken: string
  sessionId?: string
  deviceFingerprint: string
}) {
  const store = await getVendorCookieStore()

  store.set(VENDOR_ACCESS_COOKIE, payload.accessToken, buildCookieOptions(ACCESS_MAX_AGE))
  store.set(VENDOR_REFRESH_COOKIE, payload.refreshToken, buildCookieOptions(REFRESH_MAX_AGE))
  store.set(VENDOR_DEVICE_COOKIE, payload.deviceFingerprint, buildCookieOptions(REFRESH_MAX_AGE))

  if (payload.sessionId) {
    store.set(VENDOR_SESSION_COOKIE, payload.sessionId, buildCookieOptions(REFRESH_MAX_AGE))
  }
}

export async function clearVendorSessionCookies() {
  const store = await getVendorCookieStore()
  for (const key of [
    VENDOR_ACCESS_COOKIE,
    VENDOR_REFRESH_COOKIE,
    VENDOR_SESSION_COOKIE,
    VENDOR_DEVICE_COOKIE,
  ]) {
    store.delete(key)
  }
}

export async function getVendorSession() {
  const store = await getVendorCookieStore()
  return {
    accessToken: store.get(VENDOR_ACCESS_COOKIE)?.value,
    refreshToken: store.get(VENDOR_REFRESH_COOKIE)?.value,
    sessionId: store.get(VENDOR_SESSION_COOKIE)?.value,
    deviceFingerprint: store.get(VENDOR_DEVICE_COOKIE)?.value,
  }
}
