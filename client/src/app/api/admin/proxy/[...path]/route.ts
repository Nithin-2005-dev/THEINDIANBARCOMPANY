import { NextRequest } from "next/server"
import { proxyDelete, proxyGet, proxyPatch, proxyPost } from "@/lib/admin-proxy"

function buildPath(request: NextRequest, params: { path: string[] }) {
  const search = request.nextUrl.search
  return `/${params.path.join("/")}${search}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolved = await params
  return proxyGet(request, buildPath(request, resolved))
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolved = await params
  return proxyPost(request, buildPath(request, resolved))
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolved = await params
  return proxyPatch(request, buildPath(request, resolved))
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolved = await params
  return proxyDelete(request, buildPath(request, resolved))
}
