import { NextRequest, NextResponse } from "next/server"
import { proxyStaffGet } from "@/lib/staff-proxy"
import { isStaffRole } from "@/lib/roles"

export async function GET(request: NextRequest) {
  const response = await proxyStaffGet(request, "/auth/me")

  if (response.status !== 200) {
    return response
  }

  const data = await response.clone().json()

  if (!isStaffRole(data.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  return response
}
