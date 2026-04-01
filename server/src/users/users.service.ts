import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma, Role, User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { isStaffRole } from '../common/auth/role-helpers';
import type { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findByIdOrThrow(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (!dto.phone && !dto.email && !dto.name) {
      throw new BadRequestException('Provide at least one field to update.');
    }

    if (dto.phone || dto.email) {
      await this.ensureUniqueContacts(userId, dto.phone, dto.email);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });

    return this.serializeUser(user);
  }

  async createStaff(dto: CreateStaffUserDto, actor: AuthUser) {
    if (!isStaffRole(dto.role)) {
      throw new BadRequestException(
        'Staff accounts must use an internal operational role.',
      );
    }

    if (!dto.phone && !dto.email) {
      throw new BadRequestException(
        'Staff accounts must include a phone number or email address.',
      );
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(dto.phone ? [{ phone: dto.phone }] : []),
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      },
    });

    if (existing) {
      throw new BadRequestException(
        'A user with this phone or email already exists.',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        name: dto.name,
        role: dto.role,
        isActive: true,
      },
    });

    await this.auditService.log({
      action: AuditAction.USER_CREATED,
      entityType: 'User',
      entityId: user.id,
      userId: actor.userId,
      metadata: {
        role: user.role,
        phone: user.phone,
        email: user.email,
      },
    });

    return this.serializeUser(user);
  }

  async updateRole(userId: string, dto: UpdateUserRoleDto, actor: AuthUser) {
    if (!isStaffRole(dto.role)) {
      throw new BadRequestException(
        'Only internal staff roles can be assigned here.',
      );
    }

    const existing = await this.findByIdOrThrow(userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: dto.role,
      },
    });

    await this.auditService.log({
      action: AuditAction.USER_ROLE_UPDATED,
      entityType: 'User',
      entityId: user.id,
      userId: actor.userId,
      metadata: {
        oldRole: existing.role,
        newRole: dto.role,
      },
    });

    return this.serializeUser(user);
  }

  async updateStatus(
    userId: string,
    dto: UpdateUserStatusDto,
    actor: AuthUser,
  ) {
    await this.findByIdOrThrow(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: dto.isActive,
      },
    });

    await this.auditService.log({
      action: AuditAction.USER_STATUS_UPDATED,
      entityType: 'User',
      entityId: user.id,
      userId: actor.userId,
      metadata: {
        isActive: dto.isActive,
      },
    });

    return this.serializeUser(user);
  }

  async listUsers(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildUserWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((user) => this.serializeUser(user)),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  serializeUser(user: User) {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async ensureUniqueContacts(
    userId: string,
    phone?: string,
    email?: string,
  ) {
    const clauses = [
      ...(phone ? [{ phone }] : []),
      ...(email ? [{ email }] : []),
    ];

    if (clauses.length === 0) {
      return;
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        id: { not: userId },
        OR: clauses,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Another user already uses this phone number or email.',
      );
    }
  }

  private buildUserWhere(query: ListUsersQueryDto): Prisma.UserWhereInput {
    const search = query.search?.trim();

    return {
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      deletedAt: null,
    };
  }
}
