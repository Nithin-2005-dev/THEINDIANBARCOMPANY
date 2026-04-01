import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  Prisma,
  ProjectTaskPriority,
  ProjectTaskStatus,
  Role,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { isAdminRole, isStaffRole } from '../common/auth/role-helpers';
import type { AuthUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { CreateProjectDocumentUploadDto } from './dto/create-project-document-upload.dto';
import { CreateProjectTaskCommentDto } from './dto/create-project-task-comment.dto';
import { CreateProjectTaskDto } from './dto/create-project-task.dto';
import { UpdateProjectTaskDto } from './dto/update-project-task.dto';

type ProjectContext = Prisma.ProjectGetPayload<{
  include: {
    assignments: true;
    vendors: true;
    client: true;
    contract: {
      include: {
        proposal: {
          include: {
            lead: true;
          };
        };
      };
    };
  };
}>;

@Injectable()
export class ProjectExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly queueService: QueueService,
    private readonly storageService: StorageService,
  ) {}

  async listTasks(projectId: string, user: AuthUser) {
    const access = await this.ensureProjectAccess(projectId, user);

    const where: Prisma.ProjectTaskWhereInput = {
      projectId,
      deletedAt: null,
      ...(user.role === Role.VENDOR && access.vendor
        ? { assignedVendorId: access.vendor.id }
        : {}),
    };

    return this.prisma.projectTask.findMany({
      where,
      include: this.getTaskInclude(),
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async createTask(
    projectId: string,
    dto: CreateProjectTaskDto,
    user: AuthUser,
  ) {
    const access = await this.ensureProjectAccess(projectId, user, {
      staffOnly: true,
    });

    const [assignedUser, assignedVendor] = await Promise.all([
      dto.assignedUserId
        ? this.ensureAssignableUser(dto.assignedUserId)
        : Promise.resolve(null),
      dto.assignedVendorId
        ? this.ensureProjectVendor(projectId, dto.assignedVendorId)
        : Promise.resolve(null),
    ]);

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.projectTask.create({
        data: {
          projectId,
          title: dto.title.trim(),
          description: dto.description?.trim(),
          priority: dto.priority ?? ProjectTaskPriority.MEDIUM,
          status: dto.status ?? ProjectTaskStatus.PENDING,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          dependencyIds: dto.dependencyIds ?? [],
          checklist: this.normalizeChecklist(dto.checklist),
          assignedUserId: assignedUser?.id,
          assignedVendorId: assignedVendor?.id,
          createdById: user.userId,
        },
      });

      await tx.projectTaskActivity.create({
        data: {
          taskId: created.id,
          actorId: user.userId,
          type: 'TASK_CREATED',
          description: `Task "${created.title}" created`,
          metadata: {
            assignedUserId: assignedUser?.id,
            assignedVendorId: assignedVendor?.id,
          },
        },
      });

      return tx.projectTask.findUniqueOrThrow({
        where: { id: created.id },
        include: this.getTaskInclude(),
      });
    });

    await this.recalculateProjectProgress(projectId);
    await this.auditService.log({
      action: AuditAction.TASK_CREATED,
      entityType: 'ProjectTask',
      entityId: task.id,
      userId: user.userId,
      metadata: {
        projectId,
        assignedUserId: assignedUser?.id,
        assignedVendorId: assignedVendor?.id,
        dueDate: task.dueDate?.toISOString() ?? null,
      },
    });
    await this.notifyTaskAssignees(task, access.project);
    await this.scheduleTaskAlerts(task, access.project);

    return task;
  }

  async updateTask(
    projectId: string,
    taskId: string,
    dto: UpdateProjectTaskDto,
    user: AuthUser,
  ) {
    const access = await this.ensureProjectAccess(projectId, user);
    const existing = await this.prisma.projectTask.findFirst({
      where: { id: taskId, projectId, deletedAt: null },
      include: this.getTaskInclude(),
    });

    if (!existing) {
      throw new NotFoundException('Task not found.');
    }

    if (
      user.role === Role.VENDOR &&
      access.vendor &&
      existing.assignedVendorId !== access.vendor.id
    ) {
      throw new ForbiddenException(
        'You can only update tasks assigned to your vendor account.',
      );
    }

    const staffEditing = isStaffRole(user.role);
    const [assignedUser, assignedVendor] = await Promise.all([
      dto.assignedUserId && staffEditing
        ? this.ensureAssignableUser(dto.assignedUserId)
        : Promise.resolve(existing.assignedUser),
      dto.assignedVendorId && staffEditing
        ? this.ensureProjectVendor(projectId, dto.assignedVendorId)
        : Promise.resolve(existing.assignedVendor),
    ]);

    const nextStatus = dto.status ?? existing.status;
    const checklist = dto.checklist
      ? this.normalizeChecklist(dto.checklist)
      : existing.checklist;

    const task = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectTask.update({
        where: { id: taskId },
        data: {
          ...(staffEditing
            ? {
                title: dto.title?.trim(),
                description: dto.description?.trim(),
                priority: dto.priority,
                dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
                dependencyIds: dto.dependencyIds,
                assignedUserId:
                  dto.assignedUserId === undefined
                    ? undefined
                    : (assignedUser?.id ?? null),
                assignedVendorId:
                  dto.assignedVendorId === undefined
                    ? undefined
                    : (assignedVendor?.id ?? null),
              }
            : {}),
          status: nextStatus,
          blockedReason: dto.blockedReason?.trim(),
          checklist: this.toNullableJsonInput(checklist),
          completedAt:
            nextStatus === ProjectTaskStatus.DONE ? new Date() : null,
        },
      });

      await tx.projectTaskActivity.create({
        data: {
          taskId,
          actorId: user.userId,
          type: 'TASK_UPDATED',
          description: `Task "${updated.title}" updated`,
          metadata: {
            previousStatus: existing.status,
            nextStatus,
            priority: dto.priority ?? existing.priority,
          },
        },
      });

      return tx.projectTask.findUniqueOrThrow({
        where: { id: taskId },
        include: this.getTaskInclude(),
      });
    });

    await this.recalculateProjectProgress(projectId);
    await this.auditService.log({
      action: AuditAction.TASK_UPDATED,
      entityType: 'ProjectTask',
      entityId: taskId,
      userId: user.userId,
      metadata: {
        previousStatus: existing.status,
        nextStatus,
        assignedUserId: task.assignedUserId,
        assignedVendorId: task.assignedVendorId,
      },
    });
    await this.notifyTaskAssignees(task, access.project);
    await this.scheduleTaskAlerts(task, access.project);

    return task;
  }

  async addTaskComment(
    projectId: string,
    taskId: string,
    dto: CreateProjectTaskCommentDto,
    user: AuthUser,
  ) {
    const access = await this.ensureProjectAccess(projectId, user);
    const task = await this.prisma.projectTask.findFirst({
      where: { id: taskId, projectId, deletedAt: null },
      include: this.getTaskInclude(),
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    if (
      user.role === Role.VENDOR &&
      access.vendor &&
      task.assignedVendorId !== access.vendor.id
    ) {
      throw new ForbiddenException(
        'You can only comment on tasks assigned to your vendor account.',
      );
    }

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.projectTaskComment.create({
        data: {
          taskId,
          authorId: user.userId,
          body: dto.body.trim(),
        },
        include: {
          author: {
            select: this.getUserSummarySelect(),
          },
        },
      });

      await tx.projectTaskActivity.create({
        data: {
          taskId,
          actorId: user.userId,
          type: 'COMMENT_ADDED',
          description: 'Task comment added',
          metadata: {
            commentId: created.id,
          },
        },
      });

      return created;
    });

    await this.auditService.log({
      action: AuditAction.TASK_COMMENT_ADDED,
      entityType: 'ProjectTask',
      entityId: taskId,
      userId: user.userId,
      metadata: {
        projectId,
        commentId: comment.id,
      },
    });
    await this.notifyTaskComment(task, comment, access.project);

    return comment;
  }

  async listDocuments(projectId: string, user: AuthUser) {
    await this.ensureProjectAccess(projectId, user);

    return this.prisma.projectDocument.findMany({
      where: { projectId },
      include: {
        uploadedBy: {
          select: this.getUserSummarySelect(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTaskAttachmentUploadUrl(
    projectId: string,
    taskId: string,
    dto: CreateProjectDocumentUploadDto,
    user: AuthUser,
  ) {
    const access = await this.ensureProjectAccess(projectId, user);
    const task = await this.prisma.projectTask.findFirst({
      where: { id: taskId, projectId, deletedAt: null },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    if (
      user.role === Role.VENDOR &&
      access.vendor &&
      task.assignedVendorId !== access.vendor.id
    ) {
      throw new ForbiddenException(
        'You can only upload files on tasks assigned to your vendor account.',
      );
    }

    this.storageService.validateUpload(
      dto.contentType,
      dto.sizeBytes,
      this.storageService.getAttachmentAllowedTypes(),
    );

    const safeName = this.sanitizeFileName(dto.fileName);
    const key = `projects/${projectId}/tasks/${taskId}/${Date.now()}-${safeName}`;
    const upload = await this.storageService.createUploadUrl(
      key,
      dto.contentType,
    );

    const attachment = await this.prisma.projectTaskAttachment.create({
      data: {
        taskId,
        fileKey: key,
        fileName: safeName,
        fileUrl: upload.fileUrl,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
        uploadedById: user.userId,
      },
    });

    await this.prisma.projectTaskActivity.create({
      data: {
        taskId,
        actorId: user.userId,
        type: 'ATTACHMENT_UPLOADED',
        description: `${safeName} uploaded to task`,
        metadata: {
          attachmentId: attachment.id,
        },
      },
    });

    await this.auditService.log({
      action: AuditAction.FILE_UPLOADED,
      entityType: 'ProjectTask',
      entityId: taskId,
      userId: user.userId,
      metadata: {
        projectId,
        attachmentId: attachment.id,
        key,
      },
    });

    return {
      ...upload,
      attachmentId: attachment.id,
      fileUrl: upload.fileUrl,
    };
  }

  async createProjectDocumentUploadUrl(
    projectId: string,
    dto: CreateProjectDocumentUploadDto,
    user: AuthUser,
  ) {
    const access = await this.ensureProjectAccess(projectId, user);

    this.storageService.validateUpload(
      dto.contentType,
      dto.sizeBytes,
      this.storageService.getAttachmentAllowedTypes(),
    );

    const safeName = this.sanitizeFileName(dto.fileName);
    const key = `projects/${projectId}/documents/${Date.now()}-${safeName}`;
    const upload = await this.storageService.createUploadUrl(
      key,
      dto.contentType,
    );

    const document = await this.prisma.projectDocument.create({
      data: {
        projectId,
        fileKey: key,
        fileName: safeName,
        fileUrl: upload.fileUrl,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
        category:
          dto.category?.trim() ||
          (user.role === Role.VENDOR ? 'DELIVERABLE' : 'GENERAL'),
        uploadedById: user.userId,
      },
      include: {
        uploadedBy: {
          select: this.getUserSummarySelect(),
        },
      },
    });

    await this.auditService.log({
      action: AuditAction.PROJECT_DOCUMENT_UPLOADED,
      entityType: 'Project',
      entityId: projectId,
      userId: user.userId,
      metadata: {
        documentId: document.id,
        key,
        category: document.category,
      },
    });

    if (user.role === Role.VENDOR) {
      await this.notifyVendorDeliverable(document, access.project);
    }

    return {
      ...upload,
      documentId: document.id,
      document,
    };
  }

  private async ensureProjectAccess(
    projectId: string,
    user: AuthUser,
    options?: { staffOnly?: boolean },
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        assignments: {
          where: { isActive: true },
        },
        vendors: true,
        client: true,
        contract: {
          include: {
            proposal: {
              include: {
                lead: true,
              },
            },
          },
        },
      },
    });

    if (!project || project.deletedAt) {
      throw new NotFoundException('Project not found.');
    }

    if (options?.staffOnly && !isStaffRole(user.role)) {
      throw new ForbiddenException(
        'Only internal staff users can perform this action.',
      );
    }

    if (isAdminRole(user.role)) {
      return { project, vendor: null };
    }

    if (user.role === Role.VENDOR) {
      const vendor = await this.prisma.vendor.findFirst({
        where: {
          userId: user.userId,
          deletedAt: null,
        },
      });

      if (
        !vendor ||
        !project.vendors.some((assignment) => assignment.vendorId === vendor.id)
      ) {
        throw new ForbiddenException('You do not have access to this project.');
      }

      return { project, vendor };
    }

    if (isStaffRole(user.role)) {
      const assigned = project.assignments.some(
        (assignment) => assignment.userId === user.userId,
      );
      if (!assigned) {
        throw new ForbiddenException(
          'You can only access projects assigned to you.',
        );
      }
      return { project, vendor: null };
    }

    if (project.clientId !== user.userId) {
      throw new ForbiddenException('You do not have access to this project.');
    }

    return { project, vendor: null };
  }

  private async ensureAssignableUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('Assigned user not found.');
    }

    if (!user.isActive || !isStaffRole(user.role)) {
      throw new BadRequestException(
        'Only active internal staff can be assigned to project tasks.',
      );
    }

    return user;
  }

  private async ensureProjectVendor(projectId: string, vendorId: string) {
    const assignment = await this.prisma.projectVendor.findFirst({
      where: {
        projectId,
        vendorId,
      },
      include: {
        vendor: true,
      },
    });

    if (!assignment || assignment.vendor.deletedAt) {
      throw new BadRequestException(
        'Vendor must be assigned to the project first.',
      );
    }

    return assignment.vendor;
  }

  private async recalculateProjectProgress(projectId: string) {
    const [taskCount, completedCount] = await Promise.all([
      this.prisma.projectTask.count({
        where: {
          projectId,
          deletedAt: null,
        },
      }),
      this.prisma.projectTask.count({
        where: {
          projectId,
          deletedAt: null,
          status: ProjectTaskStatus.DONE,
        },
      }),
    ]);

    if (taskCount === 0) {
      return;
    }

    const progress = Math.round((completedCount / taskCount) * 100);
    await this.prisma.project.update({
      where: { id: projectId },
      data: { progress },
    });
  }

  private normalizeChecklist(
    checklist?: Array<{ id?: string; label: string; done?: boolean }>,
  ) {
    if (!checklist?.length) {
      return undefined;
    }

    return checklist.map((item) => ({
      id: item.id ?? randomUUID(),
      label: item.label.trim(),
      done: Boolean(item.done),
    })) as Prisma.InputJsonValue;
  }

  private toNullableJsonInput(
    value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
  ) {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  private sanitizeFileName(fileName: string) {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
  }

  private async notifyTaskAssignees(task: any, project: ProjectContext) {
    const notifications: Promise<unknown>[] = [];

    if (task.assignedUserId) {
      notifications.push(
        this.notificationsService.createInApp({
          userId: task.assignedUserId,
          type: 'STATUS',
          title: 'Task assigned',
          body: `${task.title} is now assigned to you.`,
          actionUrl: `/staff/projects/${project.id}`,
          metadata: {
            projectId: project.id,
            taskId: task.id,
          },
        }),
      );
    }

    const vendorUserId = task.assignedVendor?.userId;
    if (vendorUserId) {
      notifications.push(
        this.notificationsService.createInApp({
          userId: vendorUserId,
          type: 'STATUS',
          title: 'Vendor task assigned',
          body: `${task.title} is ready for your team.`,
          actionUrl: `/vendor/projects/${project.id}`,
          metadata: {
            projectId: project.id,
            taskId: task.id,
          },
        }),
      );
    }

    await Promise.all(notifications);
  }

  private async notifyTaskComment(
    task: any,
    comment: any,
    project: ProjectContext,
  ) {
    const recipientIds = new Set<string>();
    if (task.assignedUserId && task.assignedUserId !== comment.authorId) {
      recipientIds.add(task.assignedUserId);
    }
    if (task.createdById && task.createdById !== comment.authorId) {
      recipientIds.add(task.createdById);
    }
    if (
      task.assignedVendor?.userId &&
      task.assignedVendor.userId !== comment.authorId
    ) {
      recipientIds.add(task.assignedVendor.userId);
    }

    await Promise.all(
      [...recipientIds].map((recipientId) =>
        this.notificationsService.createInApp({
          userId: recipientId,
          type: 'MESSAGE',
          title: 'Task comment added',
          body: comment.body.slice(0, 120),
          actionUrl:
            task.assignedVendor?.userId === recipientId
              ? `/vendor/projects/${project.id}`
              : `/staff/projects/${project.id}`,
          metadata: {
            projectId: project.id,
            taskId: task.id,
            commentId: comment.id,
          },
        }),
      ),
    );
  }

  private async notifyVendorDeliverable(
    document: any,
    project: ProjectContext,
  ) {
    const primaryOps = project.assignments.find(
      (assignment) => assignment.role === 'PRIMARY',
    );
    if (!primaryOps?.userId) {
      return;
    }

    await this.notificationsService.createInApp({
      userId: primaryOps.userId,
      type: 'STATUS',
      title: 'Vendor deliverable uploaded',
      body: `${document.fileName} was uploaded for ${project.contract.proposal.title}.`,
      actionUrl: `/staff/projects/${project.id}`,
      metadata: {
        projectId: project.id,
        documentId: document.id,
      },
    });
  }

  private async scheduleTaskAlerts(task: any, project: ProjectContext) {
    if (!task.dueDate || task.status === ProjectTaskStatus.DONE) {
      return;
    }

    const dueAt = new Date(task.dueDate);
    const oneDayBefore = dueAt.getTime() - 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (oneDayBefore > now) {
      await this.queueService.queueReminder(
        {
          kind: 'task-due-soon',
          taskId: task.id,
          projectId: project.id,
        },
        {
          delay: oneDayBefore - now,
          jobId: `task-due-soon:${task.id}:${dueAt.toISOString()}`,
        },
      );
    }

    if (dueAt.getTime() > now) {
      await this.queueService.queueReminder(
        {
          kind: 'task-overdue',
          taskId: task.id,
          projectId: project.id,
        },
        {
          delay: dueAt.getTime() - now,
          jobId: `task-overdue:${task.id}:${dueAt.toISOString()}`,
        },
      );
    }
  }

  private getTaskInclude(): Prisma.ProjectTaskInclude {
    return {
      assignedUser: {
        select: this.getUserSummarySelect(),
      },
      assignedVendor: {
        include: {
          user: {
            select: this.getUserSummarySelect(),
          },
        },
      },
      createdBy: {
        select: this.getUserSummarySelect(),
      },
      attachments: {
        orderBy: { createdAt: 'desc' },
      },
      comments: {
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
}
