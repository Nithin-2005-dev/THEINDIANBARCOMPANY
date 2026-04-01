import { Role } from '@prisma/client';

export enum AuthWorkspaceRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  CLIENT = 'CLIENT',
  VENDOR = 'VENDOR',
}

export function matchesAuthWorkspaceRole(
  userRole: Role,
  workspaceRole: AuthWorkspaceRole,
) {
  switch (workspaceRole) {
    case AuthWorkspaceRole.ADMIN:
      return userRole === Role.ADMIN;
    case AuthWorkspaceRole.STAFF:
      return (
        userRole === Role.SALES ||
        userRole === Role.OPS ||
        userRole === Role.FINANCE
      );
    case AuthWorkspaceRole.CLIENT:
      return userRole === Role.CLIENT;
    case AuthWorkspaceRole.VENDOR:
      return userRole === Role.VENDOR;
    default:
      return false;
  }
}
