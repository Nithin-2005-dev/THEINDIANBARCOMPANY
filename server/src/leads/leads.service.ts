import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssignmentRole,
  AuditAction,
  ConversationThreadType,
  LeadActivityType,
  LeadStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { isAdminRole, isStaffRole } from '../common/auth/role-helpers';
import type { AuthUser } from '../common/types/auth-user.type';
import { buildClientPortalLoginUrl } from '../common/utils/client-portal-url';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { AssignLeadStaffDto } from './dto/assign-lead-staff.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { CreateOfflineLeadDto } from './dto/create-offline-lead.dto';
import { CreateLeadManualActivityDto } from './dto/create-lead-manual-activity.dto';
import { CreateLeadNoteDto } from './dto/create-lead-note.dto';
import {
  LeadSortBy,
  ListLeadsQueryDto,
  SortOrder,
} from './dto/list-leads-query.dto';
import { UpdateLeadNoteDto } from './dto/update-lead-note.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotencyService: IdempotencyService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateLeadDto, userId: string, idempotencyKey?: string) {
    this.ensureValidBudgetRange(dto.budgetMin, dto.budgetMax);

    return this.idempotencyService.execute({
      key: idempotencyKey,
      scope: `lead:create:${userId}`,
      userId,
      request: dto,
      execute: () =>
        this.prisma.$transaction(async (tx) => {
          const lead = await tx.lead.create({
            data: {
              ...dto,
              eventDate: new Date(dto.eventDate),
              clientId: userId,
            },
            include: this.getLeadInclude(),
          });

          await tx.leadStatusHistory.create({
            data: {
              leadId: lead.id,
              oldStatus: null,
              newStatus: lead.status,
              changedById: userId,
            },
          });

          await tx.leadActivity.create({
            data: {
              leadId: lead.id,
              type: LeadActivityType.MANUAL_ACTION,
              actorId: userId,
              description: 'Lead created',
              metadata: {
                eventType: lead.eventType,
                location: lead.location,
              },
            },
          });

          await tx.conversationThread.createMany({
            data: this.buildDefaultConversationThreads(lead.id),
            skipDuplicates: true,
          });

          await this.auditService.log({
            action: AuditAction.LEAD_CREATED,
            entityType: 'Lead',
            entityId: lead.id,
            userId,
            metadata: {
              status: lead.status,
            },
          });

          return lead;
        }),
    });
  }

  async createOfflineBooking(
    dto: CreateOfflineLeadDto,
    user: AuthUser,
    idempotencyKey?: string,
  ) {
    this.ensureValidBudgetRange(dto.budgetMin, dto.budgetMax);

    const clientEmail = dto.clientEmail.trim().toLowerCase();
    const clientPhone = dto.clientPhone?.trim() || undefined;
    const clientName = dto.clientName.trim();
    const eventDate = new Date(dto.eventDate);

    return this.idempotencyService.execute({
      key: idempotencyKey,
      scope: `lead:create:offline:${user.userId}`,
      userId: user.userId,
      request: dto,
      execute: async () => {
        const existingUser = await this.prisma.user.findFirst({
          where: {
            OR: [
              { email: clientEmail },
              ...(clientPhone ? [{ phone: clientPhone }] : []),
            ],
            deletedAt: null,
          },
        });

        if (existingUser && existingUser.role !== Role.CLIENT) {
          throw new BadRequestException(
            'The provided email or phone already belongs to a non-client account.',
          );
        }

        const client = existingUser
          ? await this.prisma.user.update({
              where: { id: existingUser.id },
              data: {
                name: clientName,
                email: existingUser.email ?? clientEmail,
                phone: existingUser.phone ?? clientPhone ?? null,
              },
            })
          : await this.prisma.user.create({
              data: {
                name: clientName,
                email: clientEmail,
                phone: clientPhone,
                role: Role.CLIENT,
              },
            });

        const activeAdmins = await this.prisma.user.findMany({
          where: {
            role: Role.ADMIN,
            isActive: true,
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });

        const lead = await this.prisma.$transaction(async (tx) => {
          const createdLead = await tx.lead.create({
            data: {
              clientId: client.id,
              eventType: dto.eventType,
              location: dto.location,
              city: dto.city,
              packageName: dto.packageName,
              packageLabel: dto.packageLabel,
              addOns: dto.addOns ?? [],
              eventDate,
              guestCount: dto.guestCount,
              budgetMin: dto.budgetMin,
              budgetMax: dto.budgetMax,
              notes: dto.notes,
              status: LeadStatus.NEW,
            },
            include: this.getLeadInclude(),
          });

          await tx.leadStatusHistory.create({
            data: {
              leadId: createdLead.id,
              oldStatus: null,
              newStatus: createdLead.status,
              changedById: user.userId,
            },
          });

          await tx.leadActivity.create({
            data: {
              leadId: createdLead.id,
              type: LeadActivityType.MANUAL_ACTION,
              actorId: user.userId,
              description: `Offline booking created for ${clientName}`,
              metadata: {
                source: 'offline_booking',
                clientEmail,
                clientPhone: clientPhone ?? null,
                packageName: dto.packageName,
                addOns: dto.addOns ?? [],
              },
            },
          });

          await tx.conversationThread.createMany({
            data: this.buildDefaultConversationThreads(createdLead.id),
            skipDuplicates: true,
          });

          const assignments = this.buildOfflineLeadAssignments(
            createdLead.id,
            user.userId,
            activeAdmins.map((admin) => admin.id),
          );

          if (assignments.length) {
            await tx.leadAssignment.createMany({
              data: assignments,
              skipDuplicates: true,
            });
          }

          return createdLead;
        });

        await this.auditService.log({
          action: AuditAction.LEAD_CREATED,
          entityType: 'Lead',
          entityId: lead.id,
          userId: user.userId,
          metadata: {
            source: 'offline_booking',
            createdForClientId: client.id,
          },
        });

        const assignedAdminIds = Array.from(
          new Set(
            this.buildOfflineLeadAssignments(
              lead.id,
              user.userId,
              activeAdmins.map((admin) => admin.id),
            )
              .map((assignment) => assignment.userId)
              .filter((assigneeId) => assigneeId !== user.userId),
          ),
        );

        await Promise.all([
          this.notificationsService.createInApp({
            userId: client.id,
            type: 'GENERAL',
            title: 'Your booking has been created',
            body: 'Our team has prepared your event brief. We will share the proposal in your client portal next.',
            actionUrl: `/dashboard/events/${lead.id}`,
            metadata: {
              leadId: lead.id,
              source: 'offline_booking',
            },
          }),
          ...(client.email
            ? [
                this.queueService.queueEmail({
                  to: client.email,
                  subject: 'Thank you for your event request',
                  template: 'lead-confirmation',
                  variables: {
                    clientName,
                    eventType: dto.eventType,
                    location: dto.location,
                    eventDate: this.formatEventDate(eventDate),
                    service:
                      dto.packageLabel ?? dto.packageName ?? dto.eventType,
                    leadId: lead.id,
                    accessEmail: client.email ?? clientEmail,
                    accessPhone: client.phone ?? clientPhone ?? '',
                    portalUrl: this.buildClientPortalUrl(lead.id),
                  },
                }),
              ]
            : []),
          ...assignedAdminIds.map((adminId) =>
            this.notificationsService.createInApp({
              userId: adminId,
              type: 'GENERAL',
              title: 'Offline booking created',
              body: `${clientName} was added as a client booking for ${dto.eventType}.`,
              actionUrl: `/admin/bookings/${lead.id}`,
              metadata: {
                leadId: lead.id,
                source: 'offline_booking',
              },
            }),
          ),
        ]);

        return {
          id: lead.id,
          status: lead.status,
          clientId: client.id,
        };
      },
    });
  }

  async findMine(userId: string, query: ListLeadsQueryDto) {
    return this.list(
      { ...query, clientId: userId },
      { userId, role: Role.CLIENT, sessionId: '' },
    );
  }

  async findAll(query: ListLeadsQueryDto, user: AuthUser) {
    return this.list(query, user);
  }

  async findOneForUser(leadId: string, user: AuthUser) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        ...this.getLeadInclude(),
        internalNotes: {
          where: { deletedAt: null },
          include: {
            author: {
              select: this.getUserSummarySelect(),
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          include: {
            actor: {
              select: this.getUserSummarySelect(),
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        statusHistory: {
          include: {
            changedBy: {
              select: this.getUserSummarySelect(),
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        assignments: {
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
        },
      },
    });

    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Lead not found.');
    }

    this.ensureLeadAccess(user, lead.clientId);
    if (isStaffRole(user.role) && !isAdminRole(user.role)) {
      await this.ensureLeadStaffAccessByLeadId(user, leadId);
    }
    return lead;
  }

  async updateStatus(leadId: string, dto: UpdateLeadStatusDto, user: AuthUser) {
    await this.ensureLeadStaffAccessByLeadId(user, leadId);

    return this.prisma.$transaction(async (tx) => {
      await this.syncLeadStatus(leadId, dto.status, {
        actorId: user.userId,
        tx,
      });

      const updatedLead = await tx.lead.findUnique({
        where: { id: leadId },
        include: this.getLeadInclude(),
      });

      if (!updatedLead) {
        throw new NotFoundException('Lead not found.');
      }

      return updatedLead;
    });
  }

  async syncLeadStatus(
    leadId: string,
    nextStatus: LeadStatus,
    options?: {
      actorId?: string;
      tx?: Prisma.TransactionClient;
      description?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const db = options?.tx ?? this.prisma;
    const lead = await db.lead.findUnique({ where: { id: leadId } });

    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Lead not found.');
    }

    if (lead.status === nextStatus) {
      return lead;
    }

    const metadata = {
      oldStatus: lead.status,
      newStatus: nextStatus,
      ...(options?.metadata ?? {}),
    };

    const updatedLead = await db.lead.update({
      where: { id: leadId },
      data: {
        status: nextStatus,
      },
    });

    await db.leadStatusHistory.create({
      data: {
        leadId,
        oldStatus: lead.status,
        newStatus: nextStatus,
        changedById: options?.actorId,
      },
    });

    await db.leadActivity.create({
      data: {
        leadId,
        type: LeadActivityType.STATUS_CHANGED,
        actorId: options?.actorId,
        description:
          options?.description ??
          `Lead status changed from ${lead.status} to ${nextStatus}`,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    await db.auditLog.create({
      data: {
        action: AuditAction.LEAD_STATUS_CHANGED,
        entityType: 'Lead',
        entityId: leadId,
        userId: options?.actorId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    return updatedLead;
  }

  async listNotes(leadId: string, user: AuthUser) {
    await this.ensureLeadExists(leadId);
    await this.ensureLeadStaffAccessByLeadId(user, leadId);

    return this.prisma.leadInternalNote.findMany({
      where: {
        leadId,
        deletedAt: null,
      },
      include: {
        author: {
          select: this.getUserSummarySelect(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createNote(leadId: string, dto: CreateLeadNoteDto, user: AuthUser) {
    await this.ensureLeadExists(leadId);
    await this.ensureLeadStaffAccessByLeadId(user, leadId);

    return this.prisma.$transaction(async (tx) => {
      const note = await tx.leadInternalNote.create({
        data: {
          leadId,
          authorId: user.userId,
          content: dto.content.trim(),
        },
        include: {
          author: {
            select: this.getUserSummarySelect(),
          },
        },
      });

      await this.createLeadActivityRecord(tx, {
        leadId,
        type: LeadActivityType.NOTE_ADDED,
        actorId: user.userId,
        description: 'Internal note added',
        metadata: {
          noteId: note.id,
        },
      });

      await this.auditService.log({
        action: AuditAction.LEAD_NOTE_CREATED,
        entityType: 'Lead',
        entityId: leadId,
        userId: user.userId,
        metadata: {
          noteId: note.id,
        },
      });

      return note;
    });
  }

  async updateNote(
    leadId: string,
    noteId: string,
    dto: UpdateLeadNoteDto,
    user: AuthUser,
  ) {
    const note = await this.ensureLeadNoteExists(leadId, noteId);
    await this.ensureLeadStaffAccessByLeadId(user, leadId);

    return this.prisma.$transaction(async (tx) => {
      const updatedNote = await tx.leadInternalNote.update({
        where: { id: noteId },
        data: {
          content: dto.content?.trim(),
        },
        include: {
          author: {
            select: this.getUserSummarySelect(),
          },
        },
      });

      await this.createLeadActivityRecord(tx, {
        leadId,
        type: LeadActivityType.NOTE_UPDATED,
        actorId: user.userId,
        description: 'Internal note updated',
        metadata: {
          noteId,
          authorId: note.authorId,
        },
      });

      await this.auditService.log({
        action: AuditAction.LEAD_NOTE_UPDATED,
        entityType: 'Lead',
        entityId: leadId,
        userId: user.userId,
        metadata: {
          noteId,
        },
      });

      return updatedNote;
    });
  }

  async deleteNote(leadId: string, noteId: string, user: AuthUser) {
    await this.ensureLeadNoteExists(leadId, noteId);
    await this.ensureLeadStaffAccessByLeadId(user, leadId);

    return this.prisma.$transaction(async (tx) => {
      const deletedNote = await tx.leadInternalNote.update({
        where: { id: noteId },
        data: {
          deletedAt: new Date(),
        },
        include: {
          author: {
            select: this.getUserSummarySelect(),
          },
        },
      });

      await this.createLeadActivityRecord(tx, {
        leadId,
        type: LeadActivityType.NOTE_DELETED,
        actorId: user.userId,
        description: 'Internal note deleted',
        metadata: {
          noteId,
        },
      });

      await this.auditService.log({
        action: AuditAction.LEAD_NOTE_DELETED,
        entityType: 'Lead',
        entityId: leadId,
        userId: user.userId,
        metadata: {
          noteId,
        },
      });

      return deletedNote;
    });
  }

  async listTimeline(leadId: string, user: AuthUser) {
    await this.ensureLeadExists(leadId);
    await this.ensureLeadStaffAccessByLeadId(user, leadId);

    return this.prisma.leadActivity.findMany({
      where: { leadId },
      include: {
        actor: {
          select: this.getUserSummarySelect(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addManualActivity(
    leadId: string,
    dto: CreateLeadManualActivityDto,
    user: AuthUser,
  ) {
    await this.ensureLeadExists(leadId);
    await this.ensureLeadStaffAccessByLeadId(user, leadId);

    return this.prisma.$transaction(async (tx) => {
      const activity = await this.createLeadActivityRecord(tx, {
        leadId,
        type: LeadActivityType.MANUAL_ACTION,
        actorId: user.userId,
        description: dto.description.trim(),
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      });

      await this.auditService.log({
        action: AuditAction.LEAD_MANUAL_ACTIVITY,
        entityType: 'Lead',
        entityId: leadId,
        userId: user.userId,
        metadata: {
          activityId: activity.id,
          description: dto.description,
        },
      });

      return activity;
    });
  }

  async listStatusHistory(leadId: string, user: AuthUser) {
    await this.ensureLeadExists(leadId);
    await this.ensureLeadStaffAccessByLeadId(user, leadId);

    return this.prisma.leadStatusHistory.findMany({
      where: { leadId },
      include: {
        changedBy: {
          select: this.getUserSummarySelect(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAssignments(leadId: string, user: AuthUser) {
    await this.ensureLeadExists(leadId);
    await this.ensureLeadStaffAccessByLeadId(user, leadId);

    return this.prisma.leadAssignment.findMany({
      where: { leadId },
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

  async assignStaff(leadId: string, dto: AssignLeadStaffDto, user: AuthUser) {
    const assignee = await this.ensureAssignableUser(dto.userId);
    await this.ensureLeadExists(leadId);

    await this.ensureLeadStaffAccessByLeadId(user, leadId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.role === AssignmentRole.PRIMARY) {
        await tx.leadAssignment.updateMany({
          where: {
            leadId,
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

      const current = await tx.leadAssignment.findFirst({
        where: {
          leadId,
          userId: dto.userId,
          role: dto.role,
          isActive: true,
        },
      });

      if (current) {
        return current;
      }

      const assignment = await tx.leadAssignment.create({
        data: {
          leadId,
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

      await this.createLeadActivityRecord(tx, {
        leadId,
        type:
          dto.role === AssignmentRole.PRIMARY
            ? LeadActivityType.OWNER_ASSIGNED
            : LeadActivityType.SUPPORTING_STAFF_ASSIGNED,
        actorId: user.userId,
        description: `${assignee.name ?? assignee.phone} assigned as ${dto.role.toLowerCase()}`,
        metadata: {
          assignmentId: assignment.id,
          assigneeId: dto.userId,
          role: dto.role,
        },
      });

      await this.auditService.log({
        action: AuditAction.LEAD_ASSIGNED,
        entityType: 'Lead',
        entityId: leadId,
        userId: user.userId,
        metadata: {
          assignmentId: assignment.id,
          assigneeId: dto.userId,
          role: dto.role,
        },
      });

      return assignment;
    });
  }

  async analytics() {
    const grouped = await this.prisma.lead.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: {
        deletedAt: null,
      },
    });

    return grouped.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    }, {});
  }

  async recordProposalCreated(
    leadId: string,
    actorId?: string,
    proposalId?: string,
  ) {
    await this.recordSystemActivity(leadId, {
      type: LeadActivityType.PROPOSAL_CREATED,
      actorId,
      description: 'Proposal created',
      metadata: proposalId ? { proposalId } : undefined,
    });
  }

  async recordContractCreated(
    leadId: string,
    actorId?: string,
    contractId?: string,
  ) {
    await this.recordSystemActivity(leadId, {
      type: LeadActivityType.CONTRACT_CREATED,
      actorId,
      description: 'Contract created',
      metadata: contractId ? { contractId } : undefined,
    });
  }

  async recordPaymentCreated(
    leadId: string,
    actorId?: string,
    paymentId?: string,
  ) {
    await this.recordSystemActivity(leadId, {
      type: LeadActivityType.PAYMENT_CREATED,
      actorId,
      description: 'Payment created',
      metadata: paymentId ? { paymentId } : undefined,
    });
  }

  async recordPaymentUpdated(
    leadId: string,
    actorId?: string,
    paymentId?: string,
    status?: string,
  ) {
    await this.recordSystemActivity(leadId, {
      type: LeadActivityType.PAYMENT_UPDATED,
      actorId,
      description: 'Payment updated',
      metadata: {
        ...(paymentId ? { paymentId } : {}),
        ...(status ? { status } : {}),
      },
    });
  }

  private async list(
    query: ListLeadsQueryDto & {
      clientId?: string;
    },
    user?: AuthUser,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildLeadWhere(query, user);
    const orderBy = this.buildLeadOrderBy(query.sortBy, query.sortOrder);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        include: {
          ...this.getLeadInclude(),
          assignments: {
            where: { isActive: true },
            include: {
              user: {
                select: this.getUserSummarySelect(),
              },
            },
            orderBy: { startedAt: 'desc' },
          },
        },
        orderBy,
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

  private buildLeadWhere(
    query: ListLeadsQueryDto & {
      clientId?: string;
    },
    user?: AuthUser,
  ): Prisma.LeadWhereInput {
    const search = query.search?.trim();
    const location = query.location?.trim();

    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(location
        ? { location: { contains: location, mode: 'insensitive' } }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            eventDate: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.budgetMin !== undefined || query.budgetMax !== undefined
        ? {
            AND: [
              ...(query.budgetMin !== undefined
                ? [{ budgetMax: { gte: query.budgetMin } }]
                : []),
              ...(query.budgetMax !== undefined
                ? [{ budgetMin: { lte: query.budgetMax } }]
                : []),
            ],
          }
        : {}),
      ...(search
        ? {
            OR: [
              { eventType: { contains: search, mode: 'insensitive' } },
              { location: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
              { client: { name: { contains: search, mode: 'insensitive' } } },
              { client: { phone: { contains: search, mode: 'insensitive' } } },
              { client: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      deletedAt: null,
      ...(user && isStaffRole(user.role) && !isAdminRole(user.role)
        ? {
            assignments: {
              some: {
                userId: user.userId,
                isActive: true,
              },
            },
          }
        : {}),
    };
  }

  private buildLeadOrderBy(
    sortBy?: LeadSortBy,
    sortOrder?: SortOrder,
  ): Prisma.LeadOrderByWithRelationInput {
    const direction = sortOrder ?? SortOrder.DESC;

    switch (sortBy) {
      case LeadSortBy.EVENT_DATE:
        return { eventDate: direction };
      case LeadSortBy.BUDGET_MIN:
        return { budgetMin: direction };
      case LeadSortBy.BUDGET_MAX:
        return { budgetMax: direction };
      case LeadSortBy.STATUS:
        return { status: direction };
      case LeadSortBy.LOCATION:
        return { location: direction };
      case LeadSortBy.CREATED_AT:
      default:
        return { createdAt: direction };
    }
  }

  private async recordSystemActivity(
    leadId: string,
    activity: {
      type: LeadActivityType;
      actorId?: string;
      description: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.deletedAt) {
      return;
    }

    await this.prisma.leadActivity.create({
      data: {
        leadId,
        type: activity.type,
        actorId: activity.actorId,
        description: activity.description,
        metadata: activity.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private getLeadInclude(): Prisma.LeadInclude {
    return {
      client: true,
      proposals: {
        include: {
          contract: true,
        },
      },
    };
  }

  private buildDefaultConversationThreads(leadId: string) {
    return [
      ConversationThreadType.GROUP,
      ConversationThreadType.DIRECT_ADMIN,
      ConversationThreadType.DIRECT_STAFF,
      ConversationThreadType.DIRECT_VENDOR,
    ].map((type) => ({
      leadId,
      type,
    }));
  }

  private buildOfflineLeadAssignments(
    leadId: string,
    creatorId: string,
    activeAdminIds: string[],
  ) {
    const assignments: Array<{
      leadId: string;
      userId: string;
      role: AssignmentRole;
      notes: string;
    }> = [];
    const seen = new Set<string>();

    const pushAssignment = (
      userId: string,
      role: AssignmentRole,
      notes: string,
    ) => {
      if (seen.has(userId)) {
        return;
      }

      seen.add(userId);
      assignments.push({
        leadId,
        userId,
        role,
        notes,
      });
    };

    pushAssignment(
      creatorId,
      AssignmentRole.PRIMARY,
      'Created from offline booking intake.',
    );

    for (const adminId of activeAdminIds) {
      pushAssignment(
        adminId,
        AssignmentRole.SUPPORTING,
        'Auto-assigned from offline booking intake.',
      );
    }

    return assignments;
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

  private ensureLeadAccess(
    user: AuthUser,
    clientId: string,
    staffOnly = false,
  ) {
    if (staffOnly) {
      if (!isStaffRole(user.role)) {
        throw new ForbiddenException(
          'This action is only available to staff users.',
        );
      }
      if (!isAdminRole(user.role)) {
        return;
      }
      return;
    }

    if (isStaffRole(user.role)) {
      return;
    }

    if (user.role !== Role.CLIENT || clientId !== user.userId) {
      throw new ForbiddenException('You cannot access this lead.');
    }
  }

  private async ensureLeadExists(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Lead not found.');
    }
    return lead;
  }

  private async ensureLeadNoteExists(leadId: string, noteId: string) {
    const note = await this.prisma.leadInternalNote.findFirst({
      where: {
        id: noteId,
        leadId,
        deletedAt: null,
      },
    });

    if (!note) {
      throw new NotFoundException('Lead note not found.');
    }

    return note;
  }

  private async ensureLeadStaffAccessByLeadId(user: AuthUser, leadId: string) {
    const lead = await this.ensureLeadExists(leadId);
    this.ensureLeadAccess(user, lead.clientId, true);
    if (!isAdminRole(user.role)) {
      const assignment = await this.prisma.leadAssignment.findFirst({
        where: {
          leadId,
          userId: user.userId,
          isActive: true,
        },
      });

      if (!assignment) {
        throw new ForbiddenException(
          'You can only manage leads assigned to you.',
        );
      }
    }
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
        'Client users cannot be assigned as staff.',
      );
    }

    return user;
  }

  private ensureValidBudgetRange(budgetMin?: number, budgetMax?: number) {
    if (
      budgetMin !== undefined &&
      budgetMax !== undefined &&
      budgetMin > budgetMax
    ) {
      throw new BadRequestException(
        'budgetMin cannot be greater than budgetMax.',
      );
    }
  }

  private formatEventDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private buildClientPortalUrl(leadId: string) {
    const siteUrl =
      this.configService.get<string>('NEXT_PUBLIC_SITE_URL')?.trim() ||
      this.configService.get<string>('FRONTEND_APP_URL')?.trim();

    return buildClientPortalLoginUrl(siteUrl, `/dashboard/events/${leadId}`);
  }

  private createLeadActivityRecord(
    tx: PrismaTx,
    input: {
      leadId: string;
      type: LeadActivityType;
      actorId?: string;
      description: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return tx.leadActivity.create({
      data: {
        leadId: input.leadId,
        type: input.type,
        actorId: input.actorId,
        description: input.description,
        metadata: input.metadata,
      },
      include: {
        actor: {
          select: this.getUserSummarySelect(),
        },
      },
    });
  }
}
