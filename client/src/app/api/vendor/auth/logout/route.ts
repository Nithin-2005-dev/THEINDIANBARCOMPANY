import { NextResponse } from "next/server"
import {
  clearVendorSessionCookies,
  getBackendApiUrl,
  getVendorSession,
} from "@/lib/vendor-auth"

export async function POST() {
  const session = await getVendorSession()

  if (session.accessToken) {
    await fetch(`${getBackendApiUrl()}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: "no-store",
    }).catch(() => undefined)
  }

  await clearVendorSessionCookies()

  return NextResponse.json({ success: true })
}
