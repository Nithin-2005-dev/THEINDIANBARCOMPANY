import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { UsersService } from '../users/users.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

interface ClientContext {
  ipAddress?: string;
  deviceFingerprint?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly queueService: QueueService,
    private readonly usersService: UsersService,
  ) {}

  async sendOtp(dto: SendOtpDto, client: ClientContext) {
    const user = await this.prisma.user.upsert({
      where: { phone: dto.phone },
      update: {
        name: dto.name,
      },
      create: {
        phone: dto.phone,
        name: dto.name,
        role: Role.CLIENT,
      },
    });

    await this.enforceOtpRequestPolicies(dto.phone);

    const otp = this.generateOtp();
    const expiryMinutes = this.configService.getOrThrow<number>('OTP_EXPIRY_MINUTES');
    const cooldownSeconds = this.configService.getOrThrow<number>('OTP_RESEND_COOLDOWN_SECONDS');
    const maxAttempts = this.configService.getOrThrow<number>('OTP_MAX_FAILURES');

    const challenge = await this.prisma.otpChallenge.create({
      data: {
        userId: user.id,
        phone: dto.phone,
        otpCodeHash: await bcrypt.hash(otp, 10),
        expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
        cooldownUntil: new Date(Date.now() + cooldownSeconds * 1000),
        requestIpAddress: client.ipAddress,
        maxAttempts,
      },
    });

    const message = `Your login OTP is ${otp}. It expires in ${expiryMinutes} minutes.`;
    await this.queueService.queueOtp({
      phone: dto.phone,
      message,
      challengeId: challenge.id,
    });
    await this.notificationsService.sendOtp(dto.phone, message);
    await this.auditService.log({
      action: AuditAction.OTP_SENT,
      entityType: 'OtpChallenge',
      entityId: challenge.id,
      userId: user.id,
      ipAddress: client.ipAddress,
      metadata: {
        phone: dto.phone,
      },
    });

    return {
      challengeId: challenge.id,
      message: 'OTP generated successfully.',
      expiresInMinutes: expiryMinutes,
      resendAvailableAt: challenge.cooldownUntil,
      debugOtp:
        this.configService.getOrThrow<string>('NODE_ENV') === 'production'
          ? undefined
          : otp,
    };
  }

  async verifyOtp(dto: VerifyOtpDto, client: ClientContext) {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        id: dto.challengeId,
        phone: dto.phone,
      },
      include: {
        user: true,
      },
    });

    if (!challenge || !challenge.user) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    const challengeUser = challenge.user;

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
          status: shouldLock ? OtpChallengeStatus.LOCKED : OtpChallengeStatus.FAILED,
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
          phone: dto.phone,
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

      return this.issueSessionTokens(freshUser, client, tx);
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
      user: this.usersService.serializeUser(challengeUser),
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

    const matches = await bcrypt.compare(dto.refreshToken, session.refreshTokenHash);
    if (!matches) {
      await this.revokeSessionInternal(session.id, 'refresh_token_mismatch');
      throw new UnauthorizedException('Refresh token expired or revoked.');
    }

    const suspiciousReason = this.detectSuspiciousActivity(session, dto.deviceFingerprint, client);
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
    tx: Pick<
      PrismaService,
      'session'
    > = this.prisma,
  ) {
    const sessionId = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        sid: sessionId,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN') as never,
      },
    );

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        sid: sessionId,
        role: user.role,
        phone: user.phone,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.configService.getOrThrow<string>('JWT_EXPIRES_IN') as never,
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

  private async enforceOtpRequestPolicies(phone: string) {
    const activeWindowStart = new Date(
      Date.now() -
        this.configService.getOrThrow<number>('OTP_REQUEST_WINDOW_MINUTES') *
          60 *
          1000,
    );
    const recentChallenges = await this.prisma.otpChallenge.findMany({
      where: {
        phone,
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
      throw new BadRequestException('OTP resend cooldown active. Please wait before retrying.');
    }

    const maxRequests = this.configService.getOrThrow<number>('OTP_MAX_REQUESTS_PER_WINDOW');
    if (recentChallenges.length >= maxRequests) {
      throw new ForbiddenException('OTP request limit exceeded for this phone number.');
    }

    const lockedChallenge = recentChallenges.find(
      (challenge) => challenge.status === OtpChallengeStatus.LOCKED,
    );
    if (lockedChallenge) {
      throw new ForbiddenException('OTP temporarily locked for this phone number.');
    }
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
    if (session.deviceFingerprint && session.deviceFingerprint !== deviceFingerprint) {
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
    const expiresIn = this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN');
    const match = /^(\d+)([smhd])$/.exec(expiresIn);

    if (!match) {
      throw new BadRequestException('JWT_REFRESH_EXPIRES_IN must use s, m, h, or d suffix.');
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
