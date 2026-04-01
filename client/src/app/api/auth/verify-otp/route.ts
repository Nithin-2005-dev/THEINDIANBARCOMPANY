import { NextRequest, NextResponse } from "next/server"
import {
  ADMIN_DEVICE_COOKIE,
  setAdminSessionCookies,
} from "@/lib/admin-auth"
import { getBackendApiUrlFromEnv } from "@/lib/backend-api-url"
import {
  CLIENT_DEVICE_COOKIE,
  setClientSessionCookies,
} from "@/lib/client-auth"

function resolveDeviceFingerprint(request: NextRequest) {
  return (
    request.cookies.get(ADMIN_DEVICE_COOKIE)?.value ||
    request.cookies.get(CLIENT_DEVICE_COOKIE)?.value ||
    `web-${crypto.randomUUID()}`
  )
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const deviceFingerprint = resolveDeviceFingerprint(request)

  const response = await fetch(`${getBackendApiUrlFromEnv()}/auth/verify-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-device-fingerprint": deviceFingerprint,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status })
  }

  if (data.user?.role === "ADMIN") {
    await setAdminSessionCookies({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      sessionId: data.session?.id,
      deviceFingerprint,
    })

    return NextResponse.json({
      user: data.user,
      session: data.session,
    })
  }

  if (data.user?.role === "CLIENT") {
    await setClientSessionCookies({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      sessionId: data.session?.id,
      deviceFingerprint,
    })

    return NextResponse.json({
      user: data.user,
      session: data.session,
    })
  }

  return NextResponse.json(
    {
      message: "This login route only supports ADMIN and CLIENT accounts.",
    },
    { status: 403 },
  )
}
