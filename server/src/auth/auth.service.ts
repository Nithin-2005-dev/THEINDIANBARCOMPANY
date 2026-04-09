import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuditAction,
  OtpChallengeStatus,
  Role,
  SessionStatus,
  User,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { UsersService } from '../users/users.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import {
  AuthWorkspaceRole,
  matchesAuthWorkspaceRole,
} from './auth-workspace-role';

interface ClientContext {
  ipAddress?: string;
  deviceFingerprint?: string;
  userAgent?: string;
}

type OtpDeliveryChannel = 'PHONE' | 'EMAIL';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly queueService: QueueService,
    private readonly usersService: UsersService,
  ) {}

  async sendOtp(dto: SendOtpDto, client: ClientContext) {
    const target = this.resolveOtpTarget(dto);
    this.assertPhoneOtpDeliveryReady(target.channel);
    const requestedRole = dto.roleHint;
    let user = await this.findUserByTarget(target.phone, target.email);

    if (!user) {
      if (requestedRole !== AuthWorkspaceRole.CLIENT) {
        throw new NotFoundException('Account not found for selected role.');
      }

      user = await this.prisma.user.create({
        data: {
          phone: target.phone ?? null,
          email: target.email ?? null,
          name: dto.name?.trim() || undefined,
          role: Role.CLIENT,
        },
      });
    } else {
      if (!matchesAuthWorkspaceRole(user.role, requestedRole)) {
        throw new ForbiddenException('Invalid role selection.');
      }

      if (!user.isActive) {
        throw new ForbiddenException('This account is inactive.');
      }

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: dto.name?.trim() || user.name,
          phone: user.phone ?? target.phone ?? null,
          email: user.email ?? target.email ?? null,
        },
      });
    }

    await this.enforceOtpRequestPolicies(target.identifier);

    const otp = this.generateOtp();
    const expiryMinutes =
      this.configService.getOrThrow<number>('OTP_EXPIRY_MINUTES');
    const cooldownSeconds = this.configService.getOrThrow<number>(
      'OTP_RESEND_COOLDOWN_SECONDS',
    );
    const maxAttempts =
      this.configService.getOrThrow<number>('OTP_MAX_FAILURES');

    const challenge = await this.prisma.otpChallenge.create({
      data: {
        userId: user.id,
        identifier: target.identifier,
        channel: target.channel,
        phone: target.phone ?? null,
        email: target.email ?? null,
        otpCodeHash: await bcrypt.hash(otp, 10),
        expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
        cooldownUntil: new Date(Date.now() + cooldownSeconds * 1000),
        requestIpAddress: client.ipAddress,
        maxAttempts,
      },
    });

    const message = `Your login OTP is ${otp}. It expires in ${expiryMinutes} minutes.`;
    const deliveryStatus = await this.queueOtpChallenge({
      challengeId: challenge.id,
      userId: user.id,
      channel: target.channel,
      destination: target.identifier,
      message,
      expiryMinutes,
      otp,
      roleHint: requestedRole,
    });

    await this.auditService.log({
      action: AuditAction.OTP_SENT,
      entityType: 'OtpChallenge',
      entityId: challenge.id,
      userId: user.id,
      ipAddress: client.ipAddress,
      metadata: {
        channel: target.channel,
        identifier: target.identifier,
        deliveryStatus,
      },
    });

    return {
      challengeId: challenge.id,
      message:
        deliveryStatus === 'FAILED'
          ? 'Verification code request created, but delivery is delayed. Please wait for a retry or request a new code when the cooldown ends.'
          : 'Verification code queued successfully.',
      expiresInMinutes: expiryMinutes,
      resendAvailableAt: challenge.cooldownUntil,
      sentTo: this.maskIdentifier(target.identifier, target.channel),
      channel: target.channel,
      deliveryStatus,
      debugOtp:
        this.configService.getOrThrow<string>('NODE_ENV') === 'production'
          ? undefined
          : otp,
    };
  }

  async verifyOtp(dto: VerifyOtpDto, client: ClientContext) {
    const target = this.resolveOtpTarget(dto);
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        id: dto.challengeId,
        identifier: target.identifier,
      },
      include: {
        user: true,
      },
    });

    if (!challenge || !challenge.user) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    const challengeUser = challenge.user;

    if (!matchesAuthWorkspaceRole(challengeUser.role, dto.expectedRole)) {
      throw new UnauthorizedException('Invalid role selection.');
    }

    if (
      challenge.status !== OtpChallengeStatus.PENDING ||
      challenge.expiresAt.getTime() < Date.now()
    ) {
      await this.markChallengeExpired(challenge.id);
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    const isOtpValid = await bcrypt.compare(dto.otp, challenge.otpCodeHash);

    if (!isOtpValid) {
      const nextAttempts = challenge.attempts + 1;
      const shouldLock = nextAttempts >= challenge.maxAttempts;
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts: nextAttempts,
          status: shouldLock
            ? OtpChallengeStatus.LOCKED
            : OtpChallengeStatus.FAILED,
          abuseDetectedAt: shouldLock ? new Date() : null,
          abuseReason: shouldLock ? 'too_many_attempts' : null,
          verifyIpAddress: client.ipAddress,
        },
      });
      await this.auditService.log({
        action: shouldLock
          ? AuditAction.SUSPICIOUS_ACTIVITY_DETECTED
          : AuditAction.OTP_FAILED,
        entityType: 'OtpChallenge',
        entityId: challenge.id,
        userId: challengeUser.id,
        ipAddress: client.ipAddress,
        metadata: {
          attempts: nextAttempts,
          channel: target.channel,
          identifier: target.identifier,
        },
      });
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    const session = await this.prisma.$transaction(async (tx) => {
      await tx.otpChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts: challenge.attempts + 1,
          status: OtpChallengeStatus.CONSUMED,
          consumedAt: new Date(),
          verifyIpAddress: client.ipAddress,
        },
      });

      const freshUser = await tx.user.update({
        where: { id: challengeUser.id },
        data: {
          lastLoginAt: new Date(),
        },
      });

      const tokens = await this.issueSessionTokens(freshUser, client, tx);
      return {
        ...tokens,
        user: this.usersService.serializeUser(freshUser),
      };
    });

    await this.auditService.log({
      action: AuditAction.OTP_VERIFIED,
      entityType: 'OtpChallenge',
      entityId: challenge.id,
      userId: challengeUser.id,
      ipAddress: client.ipAddress,
    });

    return {
      ...session,
    };
  }

  async refreshSession(dto: RefreshTokenDto, client: ClientContext) {
    let payload: { sub: string; sid: string };

    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: {
        user: true,
      },
    });

    if (
      !session ||
      !session.user ||
      session.status !== SessionStatus.ACTIVE ||
      session.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Refresh token expired or revoked.');
    }

    const matches = await bcrypt.compare(
      dto.refreshToken,
      session.refreshTokenHash,
    );
    if (!matches) {
      await this.revokeSessionInternal(session.id, 'refresh_token_mismatch');
      throw new UnauthorizedException('Refresh token expired or revoked.');
    }

    const suspiciousReason = this.detectSuspiciousActivity(
      session,
      dto.deviceFingerprint,
      client,
    );
    if (suspiciousReason) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          status: SessionStatus.SUSPICIOUS,
          suspiciousActivityAt: new Date(),
          suspiciousReason,
          lastIpAddress: client.ipAddress,
        },
      });
      await this.auditService.log({
        action: AuditAction.SUSPICIOUS_ACTIVITY_DETECTED,
        entityType: 'Session',
        entityId: session.id,
        userId: session.userId,
        ipAddress: client.ipAddress,
        metadata: {
          reason: suspiciousReason,
        },
      });
      throw new ForbiddenException('Suspicious session activity detected.');
    }

    const rotatedSession = await this.prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id: session.id },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
        },
      });

      return this.issueSessionTokens(session.user, client, tx);
    });

    await this.auditService.log({
      action: AuditAction.REFRESH_TOKEN_ISSUED,
      entityType: 'Session',
      entityId: rotatedSession.session.id,
      userId: session.userId,
      ipAddress: client.ipAddress,
      metadata: {
        rotatedFrom: session.id,
      },
    });

    return {
      ...rotatedSession,
      user: this.usersService.serializeUser(session.user),
    };
  }

  async logout(userId: string, sessionId: string) {
    await this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findFirst({
        where: {
          id: sessionId,
          userId,
        },
      });

      if (session) {
        await tx.session.update({
          where: { id: session.id },
          data: {
            status: SessionStatus.REVOKED,
            revokedAt: new Date(),
          },
        });
      }
    });

    await this.auditService.log({
      action: AuditAction.LOGOUT,
      entityType: 'Session',
      entityId: sessionId,
      userId,
    });

    return { message: 'Logged out successfully.' };
  }

  async listSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      status: session.status,
      deviceFingerprint: session.deviceFingerprint,
      initialIpAddress: session.initialIpAddress,
      lastIpAddress: session.lastIpAddress,
      lastSeenAt: session.lastSeenAt,
      createdAt: session.createdAt,
      suspiciousReason: session.suspiciousReason,
    }));
  }

  async revokeSession(userId: string, sessionId: string, reason: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    await this.revokeSessionInternal(sessionId, reason);
    return { message: 'Session revoked.' };
  }

  async getCurrentUser(userId: string) {
    const user = await this.usersService.findByIdOrThrow(userId);
    return this.usersService.serializeUser(user);
  }

  private async issueSessionTokens(
    user: User,
    client: ClientContext,
    tx: Pick<PrismaService, 'session'> = this.prisma,
  ) {
    const sessionId = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        sid: sessionId,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_REFRESH_EXPIRES_IN',
        ) as never,
      },
    );

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        sid: sessionId,
        role: user.role,
        phone: user.phone,
        email: user.email,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_EXPIRES_IN',
        ) as never,
      },
    );

    const session = await tx.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: await bcrypt.hash(refreshToken, 10),
        deviceFingerprint: client.deviceFingerprint,
        userAgent: client.userAgent,
        initialIpAddress: client.ipAddress,
        lastIpAddress: client.ipAddress,
        lastSeenAt: new Date(),
        expiresAt: this.resolveRefreshTokenExpiry(),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.getOrThrow<string>('JWT_EXPIRES_IN'),
      session: {
        id: session.id,
        deviceFingerprint: session.deviceFingerprint,
        status: session.status,
      },
    };
  }

  private async enforceOtpRequestPolicies(identifier: string) {
    const activeWindowStart = new Date(
      Date.now() -
        this.configService.getOrThrow<number>('OTP_REQUEST_WINDOW_MINUTES') *
          60 *
          1000,
    );
    const recentChallenges = await this.prisma.otpChallenge.findMany({
      where: {
        identifier,
        createdAt: {
          gte: activeWindowStart,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const activeChallenge = recentChallenges.find(
      (challenge) =>
        challenge.status === OtpChallengeStatus.PENDING &&
        challenge.cooldownUntil &&
        challenge.cooldownUntil.getTime() > Date.now(),
    );

    if (activeChallenge) {
      const secondsRemaining = Math.max(
        1,
        Math.ceil(
          (activeChallenge.cooldownUntil!.getTime() - Date.now()) / 1000,
        ),
      );
      throw new BadRequestException(
        `OTP resend cooldown active. Try again in ${this.formatDurationFromSeconds(secondsRemaining)}.`,
      );
    }

    const maxRequests = this.configService.getOrThrow<number>(
      'OTP_MAX_REQUESTS_PER_WINDOW',
    );
    if (recentChallenges.length >= maxRequests) {
      const oldestChallenge = recentChallenges[recentChallenges.length - 1];
      const retryAt = oldestChallenge
        ? new Date(
            oldestChallenge.createdAt.getTime() +
              this.configService.getOrThrow<number>(
                'OTP_REQUEST_WINDOW_MINUTES',
              ) *
                60 *
                1000,
          )
        : null;
      throw new ForbiddenException(
        retryAt && retryAt.getTime() > Date.now()
          ? `OTP request limit exceeded for this identifier. Try again in about ${this.formatDurationFromSeconds(
              Math.ceil((retryAt.getTime() - Date.now()) / 1000),
            )}.`
          : 'OTP request limit exceeded for this identifier.',
      );
    }

    const lockedChallenge = recentChallenges.find(
      (challenge) => challenge.status === OtpChallengeStatus.LOCKED,
    );
    if (lockedChallenge) {
      const lockUntil = this.resolveOtpLockUntil(lockedChallenge);

      if (lockUntil && lockUntil.getTime() > Date.now()) {
        throw new ForbiddenException(
          `Too many incorrect codes. Try again in ${this.formatDurationFromSeconds(
            Math.ceil((lockUntil.getTime() - Date.now()) / 1000),
          )}.`,
        );
      }

      await this.prisma.otpChallenge.updateMany({
        where: {
          id: lockedChallenge.id,
          status: OtpChallengeStatus.LOCKED,
        },
        data: {
          status: OtpChallengeStatus.EXPIRED,
        },
      });
    }
  }

  private async queueOtpChallenge(input: {
    challengeId: string;
    userId: string;
    channel: OtpDeliveryChannel;
    destination: string;
    message: string;
    expiryMinutes: number;
    otp: string;
    roleHint: AuthWorkspaceRole;
  }) {
    if (input.channel === 'EMAIL') {
      const delivery = await this.queueService.queueEmail({
        to: input.destination,
        subject: 'Your login OTP',
        template: 'otp-login',
        emailType: 'LOGIN_OTP',
        recipientUserId: input.userId,
        metadata: {
          challengeId: input.challengeId,
          roleHint: input.roleHint,
          channel: input.channel,
        },
        variables: {
          otp: input.otp,
          expiryMinutes: input.expiryMinutes,
          identifier: input.destination,
        },
        allowManualResend: false,
        isSensitive: true,
      });

      return delivery.status;
    }

    const queuedOtp = await this.queueService.queueOtp({
      challengeId: input.challengeId,
      channel: input.channel,
      destination: input.destination,
      message: input.message,
      subject: 'Your login OTP',
      template: 'otp-login',
      variables: {
        otp: input.otp,
        expiryMinutes: input.expiryMinutes,
        identifier: input.destination,
      },
    });

    return queuedOtp.queued ? 'QUEUED' : 'FAILED';
  }

  private resolveOtpLockUntil(challenge: { abuseDetectedAt?: Date | null }) {
    if (!challenge.abuseDetectedAt) {
      return null;
    }

    return new Date(
      challenge.abuseDetectedAt.getTime() +
        this.configService.getOrThrow<number>('OTP_LOCK_MINUTES') *
          60 *
          1000,
    );
  }

  private formatDurationFromSeconds(totalSeconds: number) {
    if (totalSeconds < 60) {
      return `${totalSeconds} second${totalSeconds === 1 ? '' : 's'}`;
    }

    const minutes = Math.ceil(totalSeconds / 60);
    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    }

    const hours = Math.ceil(minutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }

  private async findUserByTarget(phone?: string, email?: string) {
    const clauses = [
      ...(phone ? [{ phone }] : []),
      ...(email ? [{ email }] : []),
    ];

    if (clauses.length === 0) {
      return null;
    }

    return this.prisma.user.findFirst({
      where: {
        OR: clauses,
        deletedAt: null,
      },
    });
  }

  private resolveOtpTarget(dto: {
    identifier?: string;
    phone?: string;
    email?: string;
  }) {
    const rawIdentifier =
      dto.identifier?.trim() || dto.phone?.trim() || dto.email?.trim();

    if (!rawIdentifier) {
      throw new BadRequestException('Provide a phone number or email address.');
    }

    const normalizedEmail = this.isEmail(rawIdentifier)
      ? rawIdentifier.toLowerCase()
      : dto.email?.trim().toLowerCase();
    const normalizedPhone = this.isPhone(rawIdentifier)
      ? this.normalizePhoneIdentifier(rawIdentifier)
      : this.normalizePhoneIdentifier(dto.phone);

    if (!normalizedPhone && !normalizedEmail) {
      throw new BadRequestException(
        'Identifier must be a valid phone number or email address.',
      );
    }

    const channel: OtpDeliveryChannel = normalizedEmail ? 'EMAIL' : 'PHONE';
    const identifier = normalizedEmail ?? normalizedPhone!;

    return {
      channel,
      identifier,
      phone: normalizedPhone,
      email: normalizedEmail,
    };
  }

  private isPhone(value?: string | null) {
    if (!value) {
      return false;
    }

    return /^\+?[1-9]\d{9,14}$/.test(value.replace(/\s+/g, ''));
  }

  private normalizePhoneIdentifier(value?: string | null) {
    if (!value) {
      return undefined;
    }

    const compact = value.replace(/\s+/g, '');
    const digitsOnly = compact.replace(/[^\d]/g, '');

    if (/^[6-9]\d{9}$/.test(digitsOnly)) {
      return `+91${digitsOnly}`;
    }

    if (/^91\d{10}$/.test(digitsOnly)) {
      return `+${digitsOnly}`;
    }

    if (/^\+?[1-9]\d{9,14}$/.test(compact)) {
      return compact.startsWith('+') ? compact : `+${compact}`;
    }

    return compact;
  }

  private isEmail(value?: string | null) {
    if (!value) {
      return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private maskIdentifier(identifier: string, channel: OtpDeliveryChannel) {
    if (channel === 'EMAIL') {
      const [localPart, domain] = identifier.split('@');
      if (!localPart || !domain) {
        return identifier;
      }

      const visible = localPart.slice(0, 2);
      return `${visible}${'*'.repeat(Math.max(localPart.length - visible.length, 1))}@${domain}`;
    }

    const lastFour = identifier.slice(-4);
    return `${'*'.repeat(Math.max(identifier.length - 4, 4))}${lastFour}`;
  }

  private assertPhoneOtpDeliveryReady(channel: OtpDeliveryChannel) {
    if (channel !== 'PHONE') {
      return;
    }

    const provider =
      this.configService.get<string>('SMS_PROVIDER')?.trim().toLowerCase() ??
      'mock';
    const nodeEnv =
      this.configService.get<string>('NODE_ENV')?.trim().toLowerCase() ??
      'development';

    if (provider === 'mock') {
      if (nodeEnv === 'production') {
        throw new ServiceUnavailableException(
          'Phone OTP is not configured for real delivery. Set SMS_PROVIDER to twilio and add valid SMS credentials.',
        );
      }

      return;
    }

    if (provider === 'twilio') {
      const accountSid = this.configService
        .get<string>('TWILIO_ACCOUNT_SID')
        ?.trim();
      const authToken = this.configService
        .get<string>('TWILIO_AUTH_TOKEN')
        ?.trim();
      const from = this.configService.get<string>('SMS_FROM')?.trim();

      if (!accountSid || !authToken || !from) {
        throw new ServiceUnavailableException(
          'Phone OTP is not configured for real delivery. TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and SMS_FROM are required.',
        );
      }

      return;
    }

    throw new ServiceUnavailableException(
      `Phone OTP provider "${provider}" is not implemented yet. Configure Twilio for real SMS delivery.`,
    );
  }

  private detectSuspiciousActivity(
    session: {
      deviceFingerprint: string | null;
      initialIpAddress: string | null;
      lastIpAddress: string | null;
    },
    deviceFingerprint: string,
    client: ClientContext,
  ) {
    if (
      session.deviceFingerprint &&
      session.deviceFingerprint !== deviceFingerprint
    ) {
      return 'device_fingerprint_changed';
    }

    if (
      session.lastIpAddress &&
      client.ipAddress &&
      session.lastIpAddress !== client.ipAddress &&
      session.initialIpAddress !== client.ipAddress
    ) {
      return 'ip_address_changed';
    }

    return null;
  }

  private async revokeSessionInternal(sessionId: string, reason: string) {
    const session = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
        suspiciousReason: reason,
      },
    });

    await this.auditService.log({
      action: AuditAction.SESSION_REVOKED,
      entityType: 'Session',
      entityId: session.id,
      userId: session.userId,
      metadata: {
        reason,
      },
    });
  }

  private async markChallengeExpired(challengeId: string) {
    await this.prisma.otpChallenge.updateMany({
      where: {
        id: challengeId,
        status: OtpChallengeStatus.PENDING,
      },
      data: {
        status: OtpChallengeStatus.EXPIRED,
      },
    });
  }

  private resolveRefreshTokenExpiry() {
    const expiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    const match = /^(\d+)([smhd])$/.exec(expiresIn);

    if (!match) {
      throw new BadRequestException(
        'JWT_REFRESH_EXPIRES_IN must use s, m, h, or d suffix.',
      );
    }

    const value = Number(match[1]);
    const unitMs = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    }[match[2] as 's' | 'm' | 'h' | 'd'];

    return new Date(Date.now() + value * unitMs);
  }

  private generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
