import { NextRequest, NextResponse } from "next/server"
import {
  generateDeviceFingerprint,
  getBackendApiUrl,
  setAdminSessionCookies,
} from "@/lib/admin-auth"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const deviceFingerprint =
    request.cookies.get("tib_admin_device")?.value ?? generateDeviceFingerprint()

  const response = await fetch(`${getBackendApiUrl()}/auth/verify-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-device-fingerprint": deviceFingerprint,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  const data = await response.json()

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status })
  }

  if (data.user?.role !== "ADMIN") {
    return NextResponse.json(
      {
        message: "This portal currently supports ADMIN accounts only.",
      },
      { status: 403 },
    )
  }

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
