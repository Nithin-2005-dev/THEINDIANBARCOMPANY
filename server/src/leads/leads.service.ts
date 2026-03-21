import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeadStatus, Prisma, Role } from '@prisma/client';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async create(dto: CreateLeadDto, userId: string, idempotencyKey?: string) {
    if (dto.budgetMin && dto.budgetMax && dto.budgetMin > dto.budgetMax) {
      throw new BadRequestException('budgetMin cannot be greater than budgetMax.');
    }

    return this.idempotencyService.execute({
      key: idempotencyKey,
      scope: `lead:create:${userId}`,
      userId,
      request: dto,
      execute: () =>
        this.prisma.$transaction((tx) =>
          tx.lead.create({
            data: {
              ...dto,
              eventDate: new Date(dto.eventDate),
              clientId: userId,
            },
            include: {
              proposals: true,
            },
          }),
        ),
    });
  }

  async findMine(userId: string, query: ListLeadsQueryDto) {
    return this.list({ ...query, clientId: userId });
  }

  async findAll(query: ListLeadsQueryDto) {
    return this.list(query);
  }

  async findOneForUser(leadId: string, user: AuthUser) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        proposals: {
          include: {
            contract: true,
          },
        },
      },
    });

    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Lead not found.');
    }

    if (user.role !== Role.ADMIN && lead.clientId !== user.userId) {
      throw new ForbiddenException('You cannot access this lead.');
    }

    return lead;
  }

  async updateStatus(leadId: string, dto: UpdateLeadStatusDto) {
    await this.ensureLeadExists(leadId);

    return this.prisma.lead.update({
      where: { id: leadId },
      data: {
        status: dto.status,
      },
    });
  }

  async analytics() {
    const grouped = await this.prisma.lead.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    return grouped.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    }, {});
  }

  private async list(
    query: ListLeadsQueryDto & {
      clientId?: string;
    },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.LeadWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      deletedAt: null,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        include: {
          client: true,
          proposals: {
            include: {
              contract: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total },
    };
  }

  private async ensureLeadExists(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Lead not found.');
    }
    return lead;
  }
}
