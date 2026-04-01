import { NextResponse } from "next/server"
import {
  clearAdminSessionCookies,
  getAdminSession,
  getBackendApiUrl,
} from "@/lib/admin-auth"

export async function POST() {
  const session = await getAdminSession()

  if (session.accessToken) {
    await fetch(`${getBackendApiUrl()}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: "no-store",
    }).catch(() => undefined)
  }

  await clearAdminSessionCookies()

  return NextResponse.json({ success: true })
}
