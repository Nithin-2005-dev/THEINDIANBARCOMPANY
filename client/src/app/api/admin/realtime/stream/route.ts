import { NextRequest } from "next/server"
import { proxyAdminEventStream } from "@/lib/admin-proxy"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  return proxyAdminEventStream(request, "/realtime/stream")
}
