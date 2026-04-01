import { NextRequest, NextResponse } from "next/server"
import { isStaffRole } from "@/lib/roles"

type AuthCandidate = {
  path: string
  match: (role?: string | null) => boolean
}

const AUTH_CANDIDATES: AuthCandidate[] = [
  { path: "/api/admin/auth/me", match: (role) => role === "ADMIN" },
  { path: "/api/staff/auth/me", match: (role) => isStaffRole(role) },
  { path: "/api/client/auth/me", match: (role) => role === "CLIENT" },
  { path: "/api/vendor/auth/me", match: (role) => role === "VENDOR" },
]

function getSetCookieHeaders(headers: Headers) {
  const extendedHeaders = headers as Headers & {
    getSetCookie?: () => string[]
  }

  if (typeof extendedHeaders.getSetCookie === "function") {
    return extendedHeaders.getSetCookie()
  }

  const setCookie = headers.get("set-cookie")
  return setCookie ? [setCookie] : []
}

function appendSetCookieHeaders(target: NextResponse, values: string[]) {
  for (const value of values) {
    target.headers.append("set-cookie", value)
  }
}

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") ?? ""
  const setCookieHeaders: string[] = []

  for (const candidate of AUTH_CANDIDATES) {
    const response = await fetch(new URL(candidate.path, request.url), {
      headers: {
        cookie: cookieHeader,
      },
      cache: "no-store",
    })

    setCookieHeaders.push(...getSetCookieHeaders(response.headers))

    if (!response.ok) {
      continue
    }

    const data = await response.json().catch(() => null)
    const role =
      data && typeof data === "object" && "user" in data
        ? (data.user as { role?: string | null } | null)?.role
        : (data as { role?: string | null } | null)?.role

    if (!data || !candidate.match(role)) {
      continue
    }

    const nextResponse = NextResponse.json({
      user: data,
    })
    appendSetCookieHeaders(nextResponse, setCookieHeaders)
    return nextResponse
  }

  const nextResponse = NextResponse.json(
    {
      message: "Unauthorized",
    },
    { status: 401 },
  )
  appendSetCookieHeaders(nextResponse, setCookieHeaders)
  return nextResponse
}
