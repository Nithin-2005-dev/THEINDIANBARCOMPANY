import { NextResponse } from "next/server"
import {
  clearStaffSessionCookies,
  getBackendApiUrl,
  getStaffSession,
} from "@/lib/staff-auth"

export async function POST() {
  const session = await getStaffSession()

  if (session.accessToken) {
    await fetch(`${getBackendApiUrl()}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: "no-store",
    }).catch(() => undefined)
  }

  await clearStaffSessionCookies()

  return NextResponse.json({ success: true })
}
