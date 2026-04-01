import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';

@Injectable()
export class BootstrapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async bootstrapAdmin(dto: BootstrapAdminDto) {
    const expectedToken = this.resolveBootstrapToken();

    if (!expectedToken) {
      throw new NotFoundException();
    }

    if (dto.token !== expectedToken) {
      throw new UnauthorizedException('Bootstrap token is invalid.');
    }

    if (!dto.phone && !dto.email) {
      throw new BadRequestException('Phone or email is required.');
    }

    const adminCount = await this.prisma.user.count({
      where: {
        role: Role.ADMIN,
        deletedAt: null,
      },
    });

    if (adminCount > 0) {
      throw new ForbiddenException(
        'An admin account already exists. Bootstrap is closed.',
      );
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(dto.phone ? [{ phone: dto.phone }] : []),
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
        deletedAt: null,
      },
    });

    const admin = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            name: dto.name.trim(),
            phone: existing.phone ?? dto.phone ?? null,
            email: existing.email ?? dto.email ?? null,
            role: Role.ADMIN,
            isActive: true,
          },
        })
      : await this.prisma.user.create({
          data: {
            name: dto.name.trim(),
            phone: dto.phone ?? null,
            email: dto.email ?? null,
            role: Role.ADMIN,
            isActive: true,
          },
        });

    await this.auditService.log({
      action: AuditAction.ADMIN_BOOTSTRAPPED,
      entityType: 'User',
      entityId: admin.id,
      userId: admin.id,
      metadata: {
        phone: admin.phone,
        email: admin.email,
      },
    });

    return {
      id: admin.id,
      role: admin.role,
      phone: admin.phone,
      email: admin.email,
      message:
        'Admin account bootstrapped successfully. Use OTP login to continue.',
    };
  }

  private resolveBootstrapToken() {
    const token = this.configService
      .get<string>('ADMIN_BOOTSTRAP_TOKEN')
      ?.trim();

    if (!token || token === 'change-me-before-use') {
      return null;
    }

    return token;
  }
}
