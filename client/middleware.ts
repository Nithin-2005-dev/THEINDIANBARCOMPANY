import { NextRequest, NextResponse } from "next/server"
import {
  detectWorkspaceRoleFromCookies,
  getRoleLoginPath,
  getWorkspaceHomePath,
  isRolePathAllowed,
} from "@/lib/auth-routes"

function getRequestedPath(request: NextRequest) {
  const search = request.nextUrl.search
  return `${request.nextUrl.pathname}${search}`
}

function getRequiredRole(pathname: string) {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return pathname === "/admin/login" ? null : "ADMIN"
  }

  if (pathname === "/staff" || pathname.startsWith("/staff/")) {
    return pathname === "/staff/login" ? null : "STAFF"
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return "CLIENT"
  }

  if (pathname === "/vendor" || pathname.startsWith("/vendor/")) {
    return pathname === "/vendor/login" ? null : "VENDOR"
  }

  return null
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const sessionRole = detectWorkspaceRoleFromCookies(
    (cookieName) => request.cookies.get(cookieName)?.value,
  )

  if (pathname === "/admin/login") {
    return NextResponse.redirect(new URL(getRoleLoginPath("ADMIN", searchParams.get("next")), request.url))
  }

  if (pathname === "/staff/login") {
    return NextResponse.redirect(new URL(getRoleLoginPath("STAFF", searchParams.get("next")), request.url))
  }

  if (pathname === "/vendor/login") {
    return NextResponse.redirect(new URL(getRoleLoginPath("VENDOR", searchParams.get("next")), request.url))
  }

  if (pathname === "/login" || pathname === "/verify-otp") {
    if (!sessionRole) {
      return NextResponse.next()
    }

    return NextResponse.redirect(new URL(getWorkspaceHomePath(sessionRole), request.url))
  }

  const requiredRole = getRequiredRole(pathname)

  if (!requiredRole) {
    return NextResponse.next()
  }

  if (!sessionRole) {
    return NextResponse.redirect(
      new URL(getRoleLoginPath(requiredRole, getRequestedPath(request)), request.url),
    )
  }

  if (!isRolePathAllowed(sessionRole, pathname)) {
    return NextResponse.redirect(new URL(getWorkspaceHomePath(sessionRole), request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/login",
    "/verify-otp",
    "/admin",
    "/admin/:path*",
    "/staff",
    "/staff/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/vendor",
    "/vendor/:path*",
  ],
}
