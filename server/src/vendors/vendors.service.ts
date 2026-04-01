import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { ListVendorsQueryDto } from './dto/list-vendors-query.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVendorDto) {
    if (dto.enablePortalAccess && !dto.phone && !dto.email) {
      throw new BadRequestException(
        'Phone or email is required to enable vendor portal access.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      let userId: string | undefined;

      if (dto.enablePortalAccess) {
        const existingUser = await tx.user.findFirst({
          where: {
            OR: [
              ...(dto.phone ? [{ phone: dto.phone }] : []),
              ...(dto.email ? [{ email: dto.email }] : []),
            ],
            deletedAt: null,
          },
        });

        if (existingUser && existingUser.role !== Role.VENDOR) {
          throw new BadRequestException(
            'This phone or email is already linked to a non-vendor account.',
          );
        }

        const vendorUser =
          existingUser ??
          (await tx.user.create({
            data: {
              name: dto.name,
              phone: dto.phone ?? null,
              email: dto.email ?? null,
              role: Role.VENDOR,
              isActive: true,
            },
          }));

        userId = vendorUser.id;
      }

      return tx.vendor.create({
        data: {
          name: dto.name,
          serviceType: dto.serviceType,
          phone: dto.phone,
          email: dto.email,
          pricingInfo: dto.pricingInfo,
          isAvailable: dto.isAvailable,
          notes: dto.notes,
          userId,
        },
        include: {
          user: true,
        },
      });
    });
  }

  async list(query: ListVendorsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.VendorWhereInput = {
      ...(query.serviceType ? { serviceType: query.serviceType } : {}),
      ...(query.isAvailable !== undefined
        ? { isAvailable: query.isAvailable === 'true' }
        : {}),
      deletedAt: null,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vendor.findMany({
        where,
        include: {
          user: true,
          assignments: {
            include: {
              project: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total },
    };
  }

  async update(id: string, dto: UpdateVendorDto) {
    await this.ensureVendor(id);
    return this.prisma.vendor.update({
      where: { id },
      data: dto,
      include: {
        user: true,
      },
    });
  }

  async findOne(id: string) {
    await this.ensureVendor(id);
    return this.prisma.vendor.findUnique({
      where: { id },
      include: {
        user: true,
        assignments: {
          include: {
            project: true,
          },
        },
      },
    });
  }

  private async ensureVendor(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor || vendor.deletedAt) {
      throw new NotFoundException('Vendor not found.');
    }

    return vendor;
  }
}
