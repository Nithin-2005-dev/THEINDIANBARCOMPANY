import { NextRequest, NextResponse } from "next/server"
import { proxyVendorGet } from "@/lib/vendor-proxy"

export async function GET(request: NextRequest) {
  const response = await proxyVendorGet(request, "/auth/me")

  if (response.status !== 200) {
    return response
  }

  const data = await response.clone().json()

  if (data.role !== "VENDOR") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  return response
}
