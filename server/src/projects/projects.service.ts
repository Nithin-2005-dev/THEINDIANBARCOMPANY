import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentRole, AuditAction, Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { isAdminRole, isStaffRole } from '../common/auth/role-helpers';
import type { AuthUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { AssignProjectStaffDto } from './dto/assign-project-staff.dto';
import { CreateProjectUpdateDto } from './dto/create-project-update.dto';
import {
  ListProjectsQueryDto,
  ProjectSortBy,
  SortOrder,
} from './dto/list-projects-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly queueService: QueueService,
  ) {}

  async listForUser(user: AuthUser, query: ListProjectsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildProjectWhere(user, query);
    const orderBy = this.buildProjectOrderBy(query.sortBy, query.sortOrder);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: this.getProjectInclude(),
        orderBy,
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
      include: this.getProjectInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    return {
      count: projects.length,
      activeProjects: projects.filter(
        (project) =>
          project.status !== 'COMPLETED' && project.status !== 'CANCELLED',
      ).length,
      projects,
    };
  }

  async findOneForUser(id: string, user: AuthUser) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: this.getProjectInclude(),
    });

    if (!project || project.deletedAt) {
      throw new NotFoundException('Project not found.');
    }

    if (isStaffRole(user.role) && !isAdminRole(user.role)) {
      const assigned = await this.prisma.projectAssignment.findFirst({
        where: {
          projectId: id,
          userId: user.userId,
          isActive: true,
        },
      });

      if (!assigned) {
        throw new ForbiddenException(
          'You can only access projects assigned to you.',
        );
      }
    }

    if (!isStaffRole(user.role) && project.clientId !== user.userId) {
      throw new ForbiddenException('You cannot access this project.');
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto, user: AuthUser) {
    const existingProject = await this.ensureProject(id);
    if (isStaffRole(user.role) && !isAdminRole(user.role)) {
      const assigned = await this.prisma.projectAssignment.findFirst({
        where: {
          projectId: id,
          userId: user.userId,
          isActive: true,
        },
      });

      if (!assigned) {
        throw new ForbiddenException(
          'You can only update projects assigned to you.',
        );
      }
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: dto,
      include: this.getProjectInclude(),
    });

    await this.auditService.log({
      action: AuditAction.PROJECT_UPDATED,
      entityType: 'Project',
      entityId: id,
      userId: user.userId,
      metadata: dto as unknown as Prisma.InputJsonValue,
    });

    if (
      dto.status !== undefined ||
      dto.progress !== undefined ||
      dto.summary !== undefined
    ) {
      const leadId = await this.getLeadIdForProject(project.id);
      await this.notificationsService.createInApp({
        userId: existingProject.clientId,
        type: 'STATUS',
        title: 'Event progress updated',
        body: dto.summary ?? `Your event status is now ${project.status}.`,
        actionUrl: leadId ? `/dashboard/events/${leadId}` : undefined,
        metadata: {
          projectId: project.id,
          status: project.status,
          progress: project.progress,
        },
      });
    }

    return project;
  }

  async assignVendor(projectId: string, vendorId: string, user: AuthUser) {
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

    if (isStaffRole(user.role) && !isAdminRole(user.role)) {
      const assigned = await this.prisma.projectAssignment.findFirst({
        where: {
          projectId,
          userId: user.userId,
          isActive: true,
        },
      });

      if (!assigned) {
        throw new ForbiddenException(
          'You can only assign vendors on projects assigned to you.',
        );
      }
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

      await this.auditService.log({
        action: AuditAction.VENDOR_ASSIGNED,
        entityType: 'Project',
        entityId: projectId,
        userId: user.userId,
        metadata: {
          vendorId,
        },
      });

      if (vendor.userId) {
        await this.queueService.queueVendorAlert({
          vendorUserId: vendor.userId,
          vendorId,
          projectId,
          title: 'New event assignment',
          body: 'A new project is ready in your vendor portal.',
          actionUrl: `/vendor/projects/${projectId}`,
        });
      }

      return assignment;
    });
  }

  async listUpdates(projectId: string, user: AuthUser) {
    await this.findOneForUser(projectId, user);

    return this.prisma.projectUpdate.findMany({
      where: {
        projectId,
        ...(isStaffRole(user.role) ? {} : { isInternal: false }),
      },
      include: {
        createdBy: {
          select: this.getUserSummarySelect(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUpdate(
    projectId: string,
    dto: CreateProjectUpdateDto,
    user: AuthUser,
  ) {
    const project = await this.ensureProject(projectId);
    if (isStaffRole(user.role) && !isAdminRole(user.role)) {
      const assigned = await this.prisma.projectAssignment.findFirst({
        where: {
          projectId,
          userId: user.userId,
          isActive: true,
        },
      });

      if (!assigned) {
        throw new ForbiddenException(
          'You can only update projects assigned to you.',
        );
      }
    }

    const update = await this.prisma.projectUpdate.create({
      data: {
        projectId,
        stage: dto.stage,
        title: dto.title.trim(),
        body: dto.body?.trim(),
        isInternal: dto.isInternal ?? false,
        createdById: user.userId,
      },
      include: {
        createdBy: {
          select: this.getUserSummarySelect(),
        },
      },
    });

    if (!update.isInternal) {
      const leadId = await this.getLeadIdForProject(projectId);
      if (leadId) {
        await this.notificationsService.createInApp({
          userId: project.clientId,
          type: 'STATUS',
          title: update.title,
          body:
            update.body ??
            `New ${update.stage.toLowerCase()} update added to your event.`,
          actionUrl: `/dashboard/events/${leadId}`,
          metadata: {
            projectId,
            stage: update.stage,
            updateId: update.id,
          },
        });

        const client = await this.prisma.user.findUnique({
          where: { id: project.clientId },
          select: { email: true },
        });

        if (client?.email) {
          await this.queueService.queueEmail({
            to: client.email,
            subject: update.title,
            template: 'project-update',
            emailType: 'PROJECT_UPDATE',
            recipientUserId: project.clientId,
            requestedById: user.userId,
            leadId,
            projectId,
            variables: {
              title: update.title,
              body: update.body,
              stage: update.stage,
            },
          });
        }
      }
    }

    return update;
  }

  async listAssignments(projectId: string, user: AuthUser) {
    const project = await this.findOneForUser(projectId, user);

    if (!isStaffRole(user.role) && project.clientId !== user.userId) {
      throw new ForbiddenException('You cannot access project assignments.');
    }

    return this.prisma.projectAssignment.findMany({
      where: { projectId },
      include: {
        user: {
          select: this.getUserSummarySelect(),
        },
        assignedBy: {
          select: this.getUserSummarySelect(),
        },
        endedBy: {
          select: this.getUserSummarySelect(),
        },
      },
      orderBy: [{ isActive: 'desc' }, { startedAt: 'desc' }],
    });
  }

  async assignStaff(
    projectId: string,
    dto: AssignProjectStaffDto,
    user: AuthUser,
  ) {
    const [project, assignee] = await Promise.all([
      this.ensureProject(projectId),
      this.ensureAssignableUser(dto.userId),
    ]);

    if (!isStaffRole(user.role)) {
      throw new ForbiddenException(
        'Only staff users can assign project ownership.',
      );
    }

    if (!isAdminRole(user.role)) {
      const assigned = await this.prisma.projectAssignment.findFirst({
        where: {
          projectId,
          userId: user.userId,
          isActive: true,
        },
      });

      if (!assigned) {
        throw new ForbiddenException(
          'You can only assign staff on projects assigned to you.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.role === AssignmentRole.PRIMARY) {
        await tx.projectAssignment.updateMany({
          where: {
            projectId,
            role: AssignmentRole.PRIMARY,
            isActive: true,
          },
          data: {
            isActive: false,
            endedAt: new Date(),
            endedById: user.userId,
          },
        });
      }

      const current = await tx.projectAssignment.findFirst({
        where: {
          projectId,
          userId: dto.userId,
          role: dto.role,
          isActive: true,
        },
      });

      if (current) {
        return current;
      }

      const assignment = await tx.projectAssignment.create({
        data: {
          projectId,
          userId: dto.userId,
          role: dto.role,
          notes: dto.notes,
          assignedById: user.userId,
        },
        include: {
          user: {
            select: this.getUserSummarySelect(),
          },
          assignedBy: {
            select: this.getUserSummarySelect(),
          },
          endedBy: {
            select: this.getUserSummarySelect(),
          },
        },
      });

      await this.auditService.log({
        action: AuditAction.PROJECT_ASSIGNED,
        entityType: 'Project',
        entityId: projectId,
        userId: user.userId,
        metadata: {
          assignmentId: assignment.id,
          assigneeId: assignee.id,
          role: dto.role,
        },
      });

      return assignment;
    });
  }

  private getProjectInclude(): Prisma.ProjectInclude {
    return {
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
      assignments: {
        where: { isActive: true },
        include: {
          user: {
            select: this.getUserSummarySelect(),
          },
        },
        orderBy: { startedAt: 'desc' },
      },
      client: true,
    };
  }

  private getUserSummarySelect() {
    return {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
    } satisfies Prisma.UserSelect;
  }

  private buildProjectWhere(
    user: AuthUser,
    query: ListProjectsQueryDto,
  ): Prisma.ProjectWhereInput {
    const search = query.search?.trim();
    const location = query.location?.trim();

    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            contract: {
              proposal: {
                lead: {
                  eventDate: {
                    ...(query.dateFrom
                      ? { gte: new Date(query.dateFrom) }
                      : {}),
                    ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
                  },
                },
              },
            },
          }
        : {}),
      ...(location
        ? {
            contract: {
              proposal: {
                lead: {
                  location: { contains: location, mode: 'insensitive' },
                },
              },
            },
          }
        : {}),
      ...(query.budgetMin !== undefined || query.budgetMax !== undefined
        ? {
            AND: [
              ...(query.budgetMin !== undefined
                ? [
                    {
                      contract: {
                        proposal: {
                          lead: { budgetMax: { gte: query.budgetMin } },
                        },
                      },
                    },
                  ]
                : []),
              ...(query.budgetMax !== undefined
                ? [
                    {
                      contract: {
                        proposal: {
                          lead: { budgetMin: { lte: query.budgetMax } },
                        },
                      },
                    },
                  ]
                : []),
            ],
          }
        : {}),
      ...(search
        ? {
            OR: [
              { summary: { contains: search, mode: 'insensitive' } },
              { client: { name: { contains: search, mode: 'insensitive' } } },
              { client: { phone: { contains: search, mode: 'insensitive' } } },
              { client: { email: { contains: search, mode: 'insensitive' } } },
              {
                contract: {
                  proposal: {
                    title: { contains: search, mode: 'insensitive' },
                  },
                },
              },
              {
                contract: {
                  proposal: {
                    lead: {
                      eventType: { contains: search, mode: 'insensitive' },
                    },
                  },
                },
              },
              {
                contract: {
                  proposal: {
                    lead: {
                      location: { contains: search, mode: 'insensitive' },
                    },
                  },
                },
              },
            ],
          }
        : {}),
      deletedAt: null,
      ...(isAdminRole(user.role)
        ? {}
        : isStaffRole(user.role)
          ? {
              assignments: {
                some: {
                  userId: user.userId,
                  isActive: true,
                },
              },
            }
          : { clientId: user.userId }),
    };
  }

  private buildProjectOrderBy(
    sortBy?: ProjectSortBy,
    sortOrder?: SortOrder,
  ):
    | Prisma.ProjectOrderByWithRelationInput
    | Prisma.ProjectOrderByWithRelationInput[] {
    const direction = sortOrder ?? SortOrder.DESC;

    switch (sortBy) {
      case ProjectSortBy.UPDATED_AT:
        return { updatedAt: direction };
      case ProjectSortBy.PROGRESS:
        return { progress: direction };
      case ProjectSortBy.STATUS:
        return { status: direction };
      case ProjectSortBy.EVENT_DATE:
        return [
          { contract: { proposal: { lead: { eventDate: direction } } } },
          { createdAt: 'desc' },
        ];
      case ProjectSortBy.CREATED_AT:
      default:
        return { createdAt: direction };
    }
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

  private async getLeadIdForProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        contract: {
          include: {
            proposal: true,
          },
        },
      },
    });

    return project?.contract.proposal.leadId;
  }

  private async ensureAssignableUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('Assignee not found.');
    }

    if (!user.isActive) {
      throw new BadRequestException('Assignee must be active.');
    }

    if (user.role === Role.CLIENT) {
      throw new BadRequestException(
        'Client users cannot be assigned to projects.',
      );
    }

    return user;
  }
}
