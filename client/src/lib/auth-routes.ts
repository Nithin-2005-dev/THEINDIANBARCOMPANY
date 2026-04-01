import { isStaffRole } from "@/lib/roles"

export type WorkspaceRole = "CLIENT" | "STAFF" | "ADMIN" | "VENDOR"

const ROLE_QUERY_VALUE: Record<WorkspaceRole, string> = {
  CLIENT: "client",
  STAFF: "staff",
  ADMIN: "admin",
  VENDOR: "vendor",
}

const ROLE_HOME_PATH: Record<WorkspaceRole, string> = {
  CLIENT: "/dashboard",
  STAFF: "/staff",
  ADMIN: "/admin",
  VENDOR: "/vendor",
}

const ROLE_AUTH_PREFIX: Record<WorkspaceRole, string> = {
  CLIENT: "/client/auth",
  STAFF: "/staff/auth",
  ADMIN: "/admin/auth",
  VENDOR: "/vendor/auth",
}

const ROLE_PENDING_KEY: Record<WorkspaceRole, string> = {
  CLIENT: "tib_login_pending_client",
  STAFF: "tib_login_pending_staff",
  ADMIN: "tib_login_pending_admin",
  VENDOR: "tib_login_pending_vendor",
}

export const SESSION_COOKIE_NAMES: Record<WorkspaceRole, string> = {
  ADMIN: "tib_admin_access",
  STAFF: "tib_staff_access",
  CLIENT: "tib_client_access",
  VENDOR: "tib_vendor_access",
}

export const REFRESH_COOKIE_NAMES: Record<WorkspaceRole, string> = {
  ADMIN: "tib_admin_refresh",
  STAFF: "tib_staff_refresh",
  CLIENT: "tib_client_refresh",
  VENDOR: "tib_vendor_refresh",
}

export const SESSION_ID_COOKIE_NAMES: Record<WorkspaceRole, string> = {
  ADMIN: "tib_admin_session",
  STAFF: "tib_staff_session",
  CLIENT: "tib_client_session",
  VENDOR: "tib_vendor_session",
}

export const PUBLIC_LOGIN_ROLES: WorkspaceRole[] = ["CLIENT", "STAFF", "ADMIN", "VENDOR"]

export function normalizeWorkspaceRole(value?: string | null) {
  if (!value) return null

  const normalized = value.trim().toUpperCase()

  if (normalized === "ADMIN") return "ADMIN"
  if (normalized === "CLIENT") return "CLIENT"
  if (normalized === "STAFF") return "STAFF"
  if (normalized === "VENDOR") return "VENDOR"
  if (isStaffRole(normalized)) return "STAFF"

  return null
}

export function normalizeRoleQueryValue(value?: string | null) {
  return normalizeWorkspaceRole(value)
}

export function getWorkspaceHomePath(role?: string | null) {
  const workspaceRole = normalizeWorkspaceRole(role)
  return workspaceRole ? ROLE_HOME_PATH[workspaceRole] : "/login"
}

export function getRoleApiPrefix(role: WorkspaceRole) {
  return ROLE_AUTH_PREFIX[role]
}

export function getRolePendingAuthKey(role: WorkspaceRole) {
  return ROLE_PENDING_KEY[role]
}

export function getRoleQueryValue(role: WorkspaceRole) {
  return ROLE_QUERY_VALUE[role]
}

export function getRoleLoginPath(role: WorkspaceRole, nextPath?: string | null) {
  const params = new URLSearchParams()
  params.set("role", getRoleQueryValue(role))

  if (nextPath) {
    params.set("next", nextPath)
  }

  return `/login?${params.toString()}`
}

export function isRolePathAllowed(role: WorkspaceRole, pathname: string) {
  if (role === "CLIENT") {
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/")
  }

  if (role === "STAFF") {
    return pathname === "/staff" || pathname.startsWith("/staff/")
  }

  if (role === "ADMIN") {
    return pathname === "/admin" || pathname.startsWith("/admin/")
  }

  return pathname === "/vendor" || pathname.startsWith("/vendor/")
}

export function detectWorkspaceRoleFromCookies(
  getCookieValue: (cookieName: string) => string | undefined,
) {
  if (getCookieValue(SESSION_COOKIE_NAMES.ADMIN)) return "ADMIN"
  if (getCookieValue(SESSION_COOKIE_NAMES.STAFF)) return "STAFF"
  if (getCookieValue(SESSION_COOKIE_NAMES.CLIENT)) return "CLIENT"
  if (getCookieValue(SESSION_COOKIE_NAMES.VENDOR)) return "VENDOR"
  if (getCookieValue(REFRESH_COOKIE_NAMES.ADMIN)) return "ADMIN"
  if (getCookieValue(REFRESH_COOKIE_NAMES.STAFF)) return "STAFF"
  if (getCookieValue(REFRESH_COOKIE_NAMES.CLIENT)) return "CLIENT"
  if (getCookieValue(REFRESH_COOKIE_NAMES.VENDOR)) return "VENDOR"
  if (getCookieValue(SESSION_ID_COOKIE_NAMES.ADMIN)) return "ADMIN"
  if (getCookieValue(SESSION_ID_COOKIE_NAMES.STAFF)) return "STAFF"
  if (getCookieValue(SESSION_ID_COOKIE_NAMES.CLIENT)) return "CLIENT"
  if (getCookieValue(SESSION_ID_COOKIE_NAMES.VENDOR)) return "VENDOR"

  return null
}
