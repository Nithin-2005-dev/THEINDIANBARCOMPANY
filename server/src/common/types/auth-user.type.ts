import { Role } from '@prisma/client';

export interface AuthUser {
  userId: string;
  sessionId: string;
  role: Role;
  phone: string;
}
