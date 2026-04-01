import { NextRequest } from "next/server"
import { proxyStaffEventStream } from "@/lib/staff-proxy"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  return proxyStaffEventStream(request, "/realtime/stream")
}
