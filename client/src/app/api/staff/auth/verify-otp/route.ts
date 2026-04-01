import { NextRequest, NextResponse } from "next/server"
import {
  generateStaffDeviceFingerprint,
  getBackendApiUrl,
  setStaffSessionCookies,
} from "@/lib/staff-auth"
import { isStaffRole } from "@/lib/roles"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const deviceFingerprint =
    request.cookies.get("tib_staff_device")?.value ?? generateStaffDeviceFingerprint()

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

  if (!isStaffRole(data.user?.role)) {
    return NextResponse.json(
      {
        message: "This login is only for internal staff accounts.",
      },
      { status: 403 },
    )
  }

  await setStaffSessionCookies({
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
