import { NextRequest, NextResponse } from "next/server"
import { proxyGet } from "@/lib/admin-proxy"

export async function GET(request: NextRequest) {
  const response = await proxyGet(request, "/auth/me")

  if (response.status !== 200) {
    return response
  }

  const data = await response.clone().json()

  if (data.role !== "ADMIN") {
    return NextResponse.json(
      { message: "Forbidden" },
      {
        status: 403,
      },
    )
  }

  return response
}
