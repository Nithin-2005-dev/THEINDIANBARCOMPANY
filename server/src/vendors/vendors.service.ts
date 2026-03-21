import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { ListVendorsQueryDto } from './dto/list-vendors-query.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateVendorDto) {
    return this.prisma.vendor.create({
      data: dto,
    });
  }

  async list(query: ListVendorsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.VendorWhereInput = {
      ...(query.serviceType ? { serviceType: query.serviceType } : {}),
      ...(query.isAvailable !== undefined ? { isAvailable: query.isAvailable === 'true' } : {}),
      deletedAt: null,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vendor.findMany({
        where,
        include: {
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
    });
  }

  async findOne(id: string) {
    await this.ensureVendor(id);
    return this.prisma.vendor.findUnique({
      where: { id },
      include: {
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
