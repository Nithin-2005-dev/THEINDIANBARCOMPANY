import { Role } from '@prisma/client';

export interface AuthUser {
  userId: string;
  sessionId: string;
  role: Role;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}
