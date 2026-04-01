import { NextRequest } from "next/server"
import { proxyClientGet } from "@/lib/client-proxy"

export async function GET(request: NextRequest) {
  return proxyClientGet(request, "/auth/me")
}
