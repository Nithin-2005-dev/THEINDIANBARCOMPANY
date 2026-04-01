import { NextRequest, NextResponse } from "next/server"
import { getBackendApiUrlFromEnv } from "@/lib/backend-api-url"

export async function POST(request: NextRequest) {
  const body = await request.json()

  const response = await fetch(`${getBackendApiUrlFromEnv()}/auth/send-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  const text = await response.text()

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
    },
  })
}
