import { NextRequest, NextResponse } from "next/server"
import { getBackendApiUrl } from "@/lib/client-auth"

export async function POST(request: NextRequest) {
  const body = await request.json()

  const response = await fetch(`${getBackendApiUrl()}/auth/send-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  const data = await response.text()

  return new NextResponse(data, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
    },
  })
}
