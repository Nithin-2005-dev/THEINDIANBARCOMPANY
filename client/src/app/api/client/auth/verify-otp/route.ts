import { NextRequest, NextResponse } from "next/server"
import {
  generateClientDeviceFingerprint,
  getBackendApiUrl,
  setClientSessionCookies,
} from "@/lib/client-auth"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const deviceFingerprint =
    request.cookies.get("tib_client_device")?.value ?? generateClientDeviceFingerprint()

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

  if (data.user?.role !== "CLIENT") {
    return NextResponse.json(
      {
        message: "This login is only for client accounts.",
      },
      { status: 403 },
    )
  }

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
