import { apiRequest, normalizeApiError } from "@/lib/api"
import {
  getRoleApiPrefix,
  getRolePendingAuthKey,
  getWorkspaceHomePath,
  normalizeWorkspaceRole,
  type WorkspaceRole,
} from "@/lib/auth-routes"
import { isStaffRole } from "@/lib/roles"

export type SupportedLoginRole = WorkspaceRole

type LoginAuthUser = {
  id: string
  role: string
  phone?: string | null
  email?: string | null
  name?: string | null
}

export class LoginAuthError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "LoginAuthError"
    this.status = status
  }
}

export function getPostLoginRedirectPath(role?: string | null, nextPath?: string | null) {
  const workspaceRole = normalizeWorkspaceRole(role)

  if (workspaceRole === "ADMIN") {
    return nextPath?.startsWith("/admin") ? nextPath : "/admin"
  }

  if (workspaceRole === "STAFF" || isStaffRole(role)) {
    return nextPath?.startsWith("/staff") ? nextPath : "/staff"
  }

  if (workspaceRole === "CLIENT") {
    return nextPath?.startsWith("/dashboard") ? nextPath : "/dashboard"
  }

  if (workspaceRole === "VENDOR") {
    return nextPath?.startsWith("/vendor") ? nextPath : "/vendor"
  }

  return getWorkspaceHomePath(role)
}

export async function fetchSharedAuthSession() {
  return apiRequest<{ user: LoginAuthUser }>({
    url: "/auth/me",
  }).catch((error) => {
    const normalizedError = normalizeApiError(error)
    throw new LoginAuthError(
      normalizedError.message ?? "We couldn't verify your current session.",
      normalizedError.status,
    )
  })
}

export function getPendingLoginStorageKey(role: WorkspaceRole) {
  return getRolePendingAuthKey(role)
}

export async function sendSharedLoginOtp(role: WorkspaceRole, payload: {
  identifier: string
  name?: string
}) {
  return apiRequest<{
    challengeId: string
    message: string
    expiresInMinutes: number
    resendAvailableAt?: string
    sentTo?: string
    channel?: "PHONE" | "EMAIL"
  }>({
    url: `${getRoleApiPrefix(role)}/send-otp`,
    method: "POST",
    data: {
      ...payload,
      roleHint: role,
    },
  }).catch((error) => {
    const normalizedError = normalizeApiError(error)
    throw new LoginAuthError(
      normalizedError.message ?? "Unable to send OTP.",
      normalizedError.status,
    )
  })
}

export async function verifySharedLoginOtp(role: WorkspaceRole, payload: {
  challengeId: string
  identifier: string
  otp: string
}) {
  return apiRequest<{
    user: LoginAuthUser
    session?: {
      id: string
      deviceFingerprint?: string
      status?: string
    }
  }>({
    url: `${getRoleApiPrefix(role)}/verify-otp`,
    method: "POST",
    data: {
      ...payload,
      expectedRole: role,
    },
  }).catch((error) => {
    const normalizedError = normalizeApiError(error)
    throw new LoginAuthError(
      normalizedError.message ?? "Unable to verify OTP.",
      normalizedError.status,
    )
  })
}
