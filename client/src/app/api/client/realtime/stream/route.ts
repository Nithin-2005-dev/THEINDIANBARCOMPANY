import { NextRequest } from "next/server"
import { proxyClientEventStream } from "@/lib/client-proxy"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  return proxyClientEventStream(request, "/realtime/stream")
}
