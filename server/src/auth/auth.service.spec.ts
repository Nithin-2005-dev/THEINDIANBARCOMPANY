import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  OtpChallengeStatus,
  Role,
  SessionStatus,
  type User,
} from '@prisma/client';
import { AuthService } from './auth.service';
import { AuthWorkspaceRole } from './auth-workspace-role';

type MockUser = User;

function createAuthServiceHarness() {
  const users = new Map<string, MockUser>();
  type MockOtpChallenge = {
    id: string;
    userId: string;
    identifier: string;
    channel: 'PHONE' | 'EMAIL';
    phone: string | null;
    email: string | null;
    otpCodeHash: string;
    expiresAt: Date;
    cooldownUntil: Date;
    requestIpAddress?: string;
    maxAttempts: number;
    attempts: number;
    status: OtpChallengeStatus;
    createdAt: Date;
    verifyIpAddress?: string | null;
    consumedAt?: Date | null;
    abuseDetectedAt?: Date | null;
    abuseReason?: string | null;
  };
  const challenges = new Map<string, MockOtpChallenge>();
  const sessions = new Map<
    string,
    {
      id: string;
      userId: string;
      refreshTokenHash: string;
      deviceFingerprint: string | null;
      userAgent: string | null;
      initialIpAddress: string | null;
      lastIpAddress: string | null;
      lastSeenAt: Date;
      expiresAt: Date;
      status: SessionStatus;
      revokedAt?: Date | null;
      suspiciousReason?: string | null;
      suspiciousActivityAt?: Date | null;
      createdAt: Date;
    }
  >();
  let challengeCounter = 0;

  const configValues = {
    NODE_ENV: 'test',
    OTP_EXPIRY_MINUTES: 5,
    OTP_RESEND_COOLDOWN_SECONDS: 30,
    OTP_MAX_FAILURES: 5,
    OTP_REQUEST_WINDOW_MINUTES: 10,
    OTP_MAX_REQUESTS_PER_WINDOW: 5,
    JWT_REFRESH_SECRET: 'refresh-secret-refresh-secret-refresh-secret!',
    JWT_REFRESH_EXPIRES_IN: '30d',
    JWT_SECRET: 'access-secret-access-secret-access-secret!',
    JWT_EXPIRES_IN: '6h',
  } as const;

  const prisma = {
    user: {
      findFirst: jest.fn(
        async ({
          where,
        }: {
          where: { OR: Array<{ phone?: string; email?: string }> };
        }) => {
          const clauses = where.OR ?? [];
          return (
            [...users.values()].find((user) =>
              clauses.some((clause) => {
                if (clause.email) return user.email === clause.email;
                if (clause.phone) return user.phone === clause.phone;
                return false;
              }),
            ) ?? null
          );
        },
      ),
      create: jest.fn(async ({ data }: { data: Partial<MockUser> }) => {
        const id = `user-${users.size + 1}`;
        const user = {
          id,
          name: data.name ?? null,
          phone: data.phone ?? null,
          email: data.email ?? null,
          role: data.role ?? Role.CLIENT,
          isActive: true,
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        } satisfies MockUser;
        users.set(user.id, user);
        return user;
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<MockUser>;
        }) => {
          const existing = users.get(where.id);
          if (!existing) {
            throw new Error(`User ${where.id} not found`);
          }

          const nextUser = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          } satisfies MockUser;
          users.set(nextUser.id, nextUser);
          return nextUser;
        },
      ),
    },
    otpChallenge: {
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: { identifier: string; createdAt?: { gte?: Date } };
        }) => {
          return [...challenges.values()]
            .filter((challenge) => {
              if (challenge.identifier !== where.identifier) {
                return false;
              }
              if (
                where.createdAt?.gte &&
                challenge.createdAt < where.createdAt.gte
              ) {
                return false;
              }
              return true;
            })
            .sort(
              (left, right) =>
                right.createdAt.getTime() - left.createdAt.getTime(),
            );
        },
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        challengeCounter += 1;
        const challenge: MockOtpChallenge = {
          id: `challenge-${challengeCounter}`,
          userId:
            typeof data.userId === 'string' ? data.userId : 'user-mock',
          identifier:
            typeof data.identifier === 'string' ? data.identifier : '',
          channel: data.channel === 'EMAIL' ? 'EMAIL' : 'PHONE',
          phone:
            typeof data.phone === 'string' || data.phone === null
              ? (data.phone as string | null)
              : null,
          email:
            typeof data.email === 'string' || data.email === null
              ? (data.email as string | null)
              : null,
          otpCodeHash:
            typeof data.otpCodeHash === 'string' ? data.otpCodeHash : '',
          expiresAt:
            data.expiresAt instanceof Date ? data.expiresAt : new Date(),
          cooldownUntil:
            data.cooldownUntil instanceof Date ? data.cooldownUntil : new Date(),
          requestIpAddress:
            typeof data.requestIpAddress === 'string'
              ? data.requestIpAddress
              : undefined,
          maxAttempts:
            typeof data.maxAttempts === 'number' ? data.maxAttempts : 0,
          attempts: typeof data.attempts === 'number' ? data.attempts : 0,
          status: OtpChallengeStatus.PENDING,
          createdAt: new Date(),
          verifyIpAddress:
            typeof data.verifyIpAddress === 'string' ||
            data.verifyIpAddress === null
              ? (data.verifyIpAddress as string | null | undefined)
              : undefined,
          consumedAt:
            data.consumedAt instanceof Date || data.consumedAt === null
              ? (data.consumedAt as Date | null | undefined)
              : undefined,
          abuseDetectedAt:
            data.abuseDetectedAt instanceof Date || data.abuseDetectedAt === null
              ? (data.abuseDetectedAt as Date | null | undefined)
              : undefined,
          abuseReason:
            typeof data.abuseReason === 'string' || data.abuseReason === null
              ? (data.abuseReason as string | null | undefined)
              : undefined,
        };
        challenges.set(challenge.id, challenge);
        return challenge;
      }),
      deleteMany: jest.fn(async ({ where }: { where: { id: string } }) => {
        challenges.delete(where.id);
        return { count: 1 };
      }),
      findFirst: jest.fn(
        async ({ where }: { where: { id: string; identifier: string } }) => {
          const challenge = challenges.get(where.id);
          if (!challenge || challenge.identifier !== where.identifier) {
            return null;
          }

          return {
            ...challenge,
            user: users.get(challenge.userId) ?? null,
          };
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const existing = challenges.get(where.id);
          if (!existing) {
            throw new Error(`Challenge ${where.id} not found`);
          }

          const nextChallenge = {
            ...existing,
            ...data,
          };
          challenges.set(nextChallenge.id, nextChallenge);
          return nextChallenge;
        },
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; status: OtpChallengeStatus };
          data: Record<string, unknown>;
        }) => {
          const existing = challenges.get(where.id);
          if (!existing || existing.status !== where.status) {
            return { count: 0 };
          }

          const nextChallenge = {
            ...existing,
            ...data,
          };
          challenges.set(nextChallenge.id, nextChallenge);
          return { count: 1 };
        },
      ),
    },
    session: {
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            id: string;
            userId: string;
            refreshTokenHash: string;
            deviceFingerprint?: string | null;
            userAgent?: string | null;
            initialIpAddress?: string | null;
            lastIpAddress?: string | null;
            lastSeenAt: Date;
            expiresAt: Date;
          };
        }) => {
          const session = {
            ...data,
            deviceFingerprint: data.deviceFingerprint ?? null,
            userAgent: data.userAgent ?? null,
            initialIpAddress: data.initialIpAddress ?? null,
            lastIpAddress: data.lastIpAddress ?? null,
            status: SessionStatus.ACTIVE,
            createdAt: new Date(),
          };
          sessions.set(session.id, session);
          return session;
        },
      ),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(async () => []),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const existing = sessions.get(where.id);
          if (!existing) {
            throw new Error(`Session ${where.id} not found`);
          }

          const nextSession = {
            ...existing,
            ...data,
          };
          sessions.set(nextSession.id, nextSession);
          return nextSession;
        },
      ),
    },
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma),
    ),
  };

  const auditService = {
    log: jest.fn(async () => undefined),
  };

  const notificationsService = {
    sendOtp: jest.fn(async () => undefined),
  };

  const usersService = {
    serializeUser: jest.fn((user: MockUser) => ({
      id: user.id,
      role: user.role,
      email: user.email,
      phone: user.phone,
      name: user.name,
    })),
    findByIdOrThrow: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: keyof typeof configValues) => configValues[key]),
    getOrThrow: jest.fn((key: keyof typeof configValues) => {
      const value = configValues[key];
      if (value === undefined) {
        throw new Error(`Missing config value for ${String(key)}`);
      }
      return value;
    }),
  };

  const jwtService = {
    signAsync: jest.fn(
      async (
        _payload: Record<string, unknown>,
        options?: { secret?: string },
      ) => {
        return options?.secret === configValues.JWT_REFRESH_SECRET
          ? 'refresh-token'
          : 'access-token';
      },
    ),
    verifyAsync: jest.fn(),
  };

  const authService = new AuthService(
    prisma as never,
    jwtService as never,
    configService as never,
    auditService as never,
    notificationsService as never,
    usersService as never,
  );

  const clientContext = {
    ipAddress: '127.0.0.1',
    deviceFingerprint: 'test-device',
    userAgent: 'jest',
  };

  function addUser(user: Partial<MockUser> & Pick<MockUser, 'id' | 'role'>) {
    const nextUser = {
      id: user.id,
      name: user.name ?? 'Test User',
      phone: user.phone ?? null,
      email: user.email ?? null,
      role: user.role,
      isActive: user.isActive ?? true,
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt ?? new Date(),
      updatedAt: user.updatedAt ?? new Date(),
      deletedAt: user.deletedAt ?? null,
    } satisfies MockUser;
    users.set(nextUser.id, nextUser);
    return nextUser;
  }

  return {
    authService,
    prisma,
    notificationsService,
    clientContext,
    addUser,
  };
}

describe('AuthService role enforcement', () => {
  it('allows an admin to send and verify OTP when the selected role is ADMIN', async () => {
    const harness = createAuthServiceHarness();
    const admin = harness.addUser({
      id: 'admin-1',
      email: 'admin@theindianbarcompany.com',
      role: Role.ADMIN,
    });

    const sendResult = await harness.authService.sendOtp(
      {
        identifier: admin.email ?? undefined,
        roleHint: AuthWorkspaceRole.ADMIN,
      },
      harness.clientContext,
    );

    expect(sendResult.challengeId).toBeTruthy();
    expect(sendResult.debugOtp).toBeTruthy();

    const verifyResult = await harness.authService.verifyOtp(
      {
        challengeId: sendResult.challengeId,
        identifier: admin.email ?? undefined,
        otp: sendResult.debugOtp ?? '',
        expectedRole: AuthWorkspaceRole.ADMIN,
      },
      harness.clientContext,
    );

    expect(verifyResult.user.role).toBe(Role.ADMIN);
    expect(verifyResult.accessToken).toBe('access-token');
    expect(verifyResult.refreshToken).toBe('refresh-token');
  });

  it('rejects login when an existing admin is submitted through the CLIENT role', async () => {
    const harness = createAuthServiceHarness();
    harness.addUser({
      id: 'admin-1',
      email: 'admin@theindianbarcompany.com',
      role: Role.ADMIN,
    });

    await expect(
      harness.authService.sendOtp(
        {
          identifier: 'admin@theindianbarcompany.com',
          roleHint: AuthWorkspaceRole.CLIENT,
        },
        harness.clientContext,
      ),
    ).rejects.toThrow(new ForbiddenException('Invalid role selection.'));
  });

  it('rejects non-existing admins instead of creating them', async () => {
    const harness = createAuthServiceHarness();

    await expect(
      harness.authService.sendOtp(
        {
          identifier: 'missing-admin@theindianbarcompany.com',
          roleHint: AuthWorkspaceRole.ADMIN,
        },
        harness.clientContext,
      ),
    ).rejects.toThrow(
      new NotFoundException('Account not found for selected role.'),
    );
  });

  it('creates and logs in a new client when the selected role is CLIENT', async () => {
    const harness = createAuthServiceHarness();

    const sendResult = await harness.authService.sendOtp(
      {
        identifier: 'new-client@theindianbarcompany.com',
        name: 'New Client',
        roleHint: AuthWorkspaceRole.CLIENT,
      },
      harness.clientContext,
    );

    const verifyResult = await harness.authService.verifyOtp(
      {
        challengeId: sendResult.challengeId,
        identifier: 'new-client@theindianbarcompany.com',
        otp: sendResult.debugOtp ?? '',
        expectedRole: AuthWorkspaceRole.CLIENT,
      },
      harness.clientContext,
    );

    expect(harness.prisma.user.create).toHaveBeenCalled();
    expect(verifyResult.user.role).toBe(Role.CLIENT);
  });

  it('rejects OTP verification when the expected workspace role does not match the challenge user', async () => {
    const harness = createAuthServiceHarness();
    const admin = harness.addUser({
      id: 'admin-1',
      email: 'admin@theindianbarcompany.com',
      role: Role.ADMIN,
    });

    const sendResult = await harness.authService.sendOtp(
      {
        identifier: admin.email ?? undefined,
        roleHint: AuthWorkspaceRole.ADMIN,
      },
      harness.clientContext,
    );

    await expect(
      harness.authService.verifyOtp(
        {
          challengeId: sendResult.challengeId,
          identifier: admin.email ?? undefined,
          otp: sendResult.debugOtp ?? '',
          expectedRole: AuthWorkspaceRole.CLIENT,
        },
        harness.clientContext,
      ),
    ).rejects.toThrow(new UnauthorizedException('Invalid role selection.'));
  });
});
