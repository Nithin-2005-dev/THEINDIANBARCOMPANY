import { NextRequest, NextResponse } from "next/server"
import {
  generateVendorDeviceFingerprint,
  getBackendApiUrl,
  setVendorSessionCookies,
} from "@/lib/vendor-auth"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const deviceFingerprint =
    request.cookies.get("tib_vendor_device")?.value ?? generateVendorDeviceFingerprint()

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

  if (data.user?.role !== "VENDOR") {
    return NextResponse.json(
      {
        message: "This login is only for vendor accounts.",
      },
      { status: 403 },
    )
  }

  await setVendorSessionCookies({
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
