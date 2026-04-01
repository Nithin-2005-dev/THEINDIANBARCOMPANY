import { NextRequest } from "next/server"
import { proxyClientDelete, proxyClientGet, proxyClientPatch, proxyClientPost } from "@/lib/client-proxy"

function buildPath(request: NextRequest, path: string[]) {
  return `/${path.join("/")}${request.nextUrl.search}`
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params
  return proxyClientGet(request, buildPath(request, path))
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params
  return proxyClientPost(request, buildPath(request, path))
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params
  return proxyClientPatch(request, buildPath(request, path))
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params
  return proxyClientDelete(request, buildPath(request, path))
}
