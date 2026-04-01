import { NextResponse } from "next/server"
import {
  clearClientSessionCookies,
  getBackendApiUrl,
  getClientSession,
} from "@/lib/client-auth"

export async function POST() {
  const session = await getClientSession()

  if (session.accessToken) {
    await fetch(`${getBackendApiUrl()}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: "no-store",
    }).catch(() => undefined)
  }

  await clearClientSessionCookies()

  return NextResponse.json({ success: true })
}
