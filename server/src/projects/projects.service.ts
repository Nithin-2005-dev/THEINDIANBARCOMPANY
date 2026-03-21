import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(user: AuthUser, query: ListProjectsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ProjectWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      deletedAt: null,
      ...(user.role === Role.ADMIN ? {} : { clientId: user.userId }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: {
          contract: {
            include: {
              proposal: {
                include: {
                  lead: true,
                },
              },
            },
          },
          vendors: {
            include: {
              vendor: true,
            },
          },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total },
    };
  }

  async getDashboard(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { clientId: userId, deletedAt: null },
      include: {
        contract: {
          include: {
            proposal: {
              include: {
                lead: true,
              },
            },
          },
        },
        vendors: {
          include: {
            vendor: true,
          },
        },
        payments: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      count: projects.length,
      activeProjects: projects.filter((project) => project.status !== 'COMPLETED' && project.status !== 'CANCELLED').length,
      projects,
    };
  }

  async findOneForUser(id: string, user: AuthUser) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        contract: {
          include: {
            proposal: {
              include: {
                lead: true,
              },
            },
          },
        },
        vendors: {
          include: {
            vendor: true,
          },
        },
        payments: true,
      },
    });

    if (!project || project.deletedAt) {
      throw new NotFoundException('Project not found.');
    }

    if (user.role !== Role.ADMIN && project.clientId !== user.userId) {
      throw new ForbiddenException('You cannot access this project.');
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.ensureProject(id);

    return this.prisma.project.update({
      where: { id },
      data: dto,
      include: {
        contract: {
          include: {
            proposal: true,
          },
        },
        vendors: {
          include: {
            vendor: true,
          },
        },
        payments: true,
      },
    });
  }

  async assignVendor(projectId: string, vendorId: string) {
    const [project, vendor] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId } }),
      this.prisma.vendor.findUnique({ where: { id: vendorId } }),
    ]);

    if (!project || project.deletedAt) {
      throw new NotFoundException('Project not found.');
    }

    if (!vendor || vendor.deletedAt) {
      throw new NotFoundException('Vendor not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.projectVendor.upsert({
        where: {
          projectId_vendorId: {
            projectId,
            vendorId,
          },
        },
        update: {},
        create: {
          projectId,
          vendorId,
        },
      });

      await tx.vendor.update({
        where: { id: vendorId },
        data: { isAvailable: false },
      });

      return assignment;
    });
  }

  private async ensureProject(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project || project.deletedAt) {
      throw new NotFoundException('Project not found.');
    }

    return project;
  }
}
