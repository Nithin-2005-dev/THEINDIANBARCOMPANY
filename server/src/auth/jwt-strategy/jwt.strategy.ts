import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, SessionStatus } from '@prisma/client';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../common/types/auth-user.type';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  sid: string;
  role: Role;
  phone?: string | null;
  email?: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          select: {
            id: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });

    if (
      !session ||
      !session.user ||
      session.status !== SessionStatus.ACTIVE ||
      session.expiresAt.getTime() < Date.now() ||
      !session.user.isActive ||
      session.user.deletedAt
    ) {
      throw new UnauthorizedException('Session is no longer active.');
    }

    return {
      userId: payload.sub,
      sessionId: payload.sid,
      role: payload.role,
      phone: payload.phone,
      email: payload.email,
    };
  }
}
