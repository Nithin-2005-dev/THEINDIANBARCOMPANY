export const STAFF_ROLES = ["ADMIN", "SALES", "OPS", "FINANCE"] as const

export function isStaffRole(role?: string | null) {
  return Boolean(role && STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]))
}

export function isAdminRole(role?: string | null) {
  return role === "ADMIN"
}

export function canManageUsers(role?: string | null) {
  return isAdminRole(role)
}

export function canManageFinance(role?: string | null) {
  return role === "ADMIN" || role === "FINANCE"
}
