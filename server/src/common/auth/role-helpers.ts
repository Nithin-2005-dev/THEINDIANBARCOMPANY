import { Role } from '@prisma/client';

export const STAFF_ROLES = [
  Role.ADMIN,
  Role.SALES,
  Role.OPS,
  Role.FINANCE,
] as const;

export function isStaffRole(role?: Role | null): boolean {
  return Boolean(
    role && STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]),
  );
}

export function isAdminRole(role?: Role | null): boolean {
  return role === Role.ADMIN;
}

export function canManageUsers(role?: Role | null): boolean {
  return isAdminRole(role);
}

export function canManageFinance(role?: Role | null): boolean {
  return role === Role.ADMIN || role === Role.FINANCE;
}
