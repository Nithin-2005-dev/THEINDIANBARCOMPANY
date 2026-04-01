import { NextRequest } from "next/server"
import { proxyVendorDelete, proxyVendorGet, proxyVendorPatch, proxyVendorPost } from "@/lib/vendor-proxy"

function buildPath(request: NextRequest, params: { path: string[] }) {
  const search = request.nextUrl.search
  return `/${params.path.join("/")}${search}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolved = await params
  return proxyVendorGet(request, buildPath(request, resolved))
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolved = await params
  return proxyVendorPost(request, buildPath(request, resolved))
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolved = await params
  return proxyVendorPatch(request, buildPath(request, resolved))
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolved = await params
  return proxyVendorDelete(request, buildPath(request, resolved))
}
