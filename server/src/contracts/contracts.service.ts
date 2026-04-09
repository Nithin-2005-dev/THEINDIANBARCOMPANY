import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ContractStatus,
  ProposalStatus,
  Role,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { isAdminRole, isStaffRole } from '../common/auth/role-helpers';
import { AuthUser } from '../common/types/auth-user.type';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { LeadsService } from '../leads/leads.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateContractFromTemplateDto } from './dto/create-contract-from-template.dto';
import { ContractTemplatePreviewDto } from './dto/contract-template-preview.dto';
import { SignContractDto } from './dto/sign-contract.dto';
import { UpdateContractStatusDto } from './dto/update-contract-status.dto';
import { CreateUploadUrlDto } from '../storage/dto/create-upload-url.dto';
import {
  getTemplateDefinition,
  listContractTemplateMetadata,
  renderTemplateDocument,
} from './contract-templates';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly idempotencyService: IdempotencyService,
    private readonly leadsService: LeadsService,
    private readonly notificationsService: NotificationsService,
    private readonly queueService: QueueService,
  ) {}

  listTemplates() {
    return listContractTemplateMetadata();
  }

  async create(
    dto: CreateContractDto,
    actorId?: string,
    idempotencyKey?: string,
  ) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: dto.proposalId },
      include: { contract: true, lead: true },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found.');
    }

    if (proposal.status !== ProposalStatus.ACCEPTED) {
      throw new BadRequestException(
        'A contract can only be created for an accepted proposal.',
      );
    }

    if (proposal.contract) {
      throw new BadRequestException(
        'Contract already exists for this proposal.',
      );
    }

    return this.idempotencyService.execute({
      key: idempotencyKey,
      scope: `contract:create:${dto.proposalId}`,
      userId: proposal.lead.clientId,
      request: dto,
      execute: () =>
        this.createContractRecord({
          proposalId: dto.proposalId,
          documentUrl: dto.documentUrl,
          status: dto.status ?? ContractStatus.SENT,
          actorId,
        }),
    });
  }

  async listForUser(user: AuthUser) {
    return this.prisma.contract.findMany({
      where: isStaffRole(user.role)
        ? {}
        : { proposal: { lead: { clientId: user.userId } } },
      include: {
        proposal: {
          include: {
            lead: {
              include: {
                client: true,
              },
            },
          },
        },
        project: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async previewTemplate(dto: ContractTemplatePreviewDto) {
    const proposal = await this.loadTemplateProposal(dto.proposalId);
    const template = getTemplateDefinition(dto.templateId);

    if (!template) {
      throw new NotFoundException('Contract template not found.');
    }

    return renderTemplateDocument(template, proposal, dto.fields);
  }

  async createFromTemplate(
    dto: CreateContractFromTemplateDto,
    actorId?: string,
    idempotencyKey?: string,
  ) {
    const proposal = await this.loadTemplateProposal(dto.proposalId);
    const template = getTemplateDefinition(dto.templateId);

    if (!template) {
      throw new NotFoundException('Contract template not found.');
    }

    const rendered = renderTemplateDocument(template, proposal, dto.fields);

    return this.idempotencyService.execute({
      key: idempotencyKey,
      scope: `contract:template-create:${dto.proposalId}:${dto.templateId}`,
      userId: proposal.lead.clientId,
      request: dto,
      execute: async () => {
        const key = `contracts/generated/${dto.proposalId}/${Date.now()}-${this.sanitizeFileName(rendered.suggestedFileName)}`;
        const upload = await this.storageService.uploadObject(
          key,
          'text/html; charset=utf-8',
          rendered.html,
        );

        return this.createContractRecord({
          proposalId: dto.proposalId,
          documentUrl: upload.fileUrl,
          status: dto.status ?? ContractStatus.SENT,
          actorId,
          versionKey: key,
        });
      },
    });
  }

  async createDraftDocumentUploadUrl(
    proposalId: string,
    dto: CreateUploadUrlDto,
    user: AuthUser,
  ) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        lead: true,
      },
    });

    if (!proposal || proposal.deletedAt) {
      throw new NotFoundException('Proposal not found.');
    }

    if (proposal.status !== ProposalStatus.ACCEPTED) {
      throw new BadRequestException(
        'Only accepted proposals can receive contract drafts.',
      );
    }

    if (!isStaffRole(user.role)) {
      throw new ForbiddenException(
        'Only staff users can upload contract drafts.',
      );
    }

    this.storageService.validateUpload(dto.contentType, dto.sizeBytes);

    const safeName = this.sanitizeFileName(dto.fileName);
    const key = `contracts/proposals/${proposalId}/drafts/${Date.now()}-${safeName}`;
    const upload = await this.storageService.createUploadUrl(
      key,
      dto.contentType,
    );

    await this.auditService.log({
      action: AuditAction.FILE_UPLOADED,
      entityType: 'Proposal',
      entityId: proposalId,
      userId: user.userId,
      metadata: {
        key,
        fileName: safeName,
      },
    });

    return upload;
  }

  async updateStatus(id: string, dto: UpdateContractStatusDto) {
    const existing = await this.ensureContract(id);

    if (existing.status === ContractStatus.ARCHIVED) {
      throw new BadRequestException('Archived contracts cannot be changed.');
    }

    if (
      dto.status === ContractStatus.ARCHIVED &&
      existing.status !== ContractStatus.SIGNED &&
      existing.status !== ContractStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Only signed or cancelled contracts can be archived.',
      );
    }

    return this.prisma.contract.update({
      where: { id },
      data: {
        status: dto.status,
        signedAt: dto.status === ContractStatus.SIGNED ? new Date() : null,
      },
      include: {
        proposal: {
          include: {
            lead: {
              include: {
                client: true,
              },
            },
          },
        },
        project: true,
      },
    });
  }

  async sign(
    id: string,
    dto: SignContractDto,
    user: AuthUser,
    idempotencyKey?: string,
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        project: true,
        proposal: {
          include: {
            lead: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found.');
    }

    if (contract.proposal.lead.clientId !== user.userId) {
      throw new ForbiddenException('You cannot sign this contract.');
    }

    if (
      contract.status === ContractStatus.CANCELLED ||
      contract.status === ContractStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'This contract is no longer open for signature.',
      );
    }

    if (!dto.acceptedTerms) {
      throw new BadRequestException(
        'Contract terms must be accepted before signing.',
      );
    }

    return this.idempotencyService.execute({
      key: idempotencyKey,
      scope: `contract:sign:${id}`,
      userId: user.userId,
      request: { id },
      execute: () =>
        this.prisma
          .$transaction(async (tx) => {
            const updatedContract = await tx.contract.update({
              where: { id },
              data: {
                status: ContractStatus.SIGNED,
                signedAt: new Date(),
                signedByName: dto.signerName.trim(),
                acceptedTermsAt: new Date(),
              },
            });

            if (!contract.project) {
              await tx.project.create({
                data: {
                  contractId: contract.id,
                  clientId: contract.proposal.lead.clientId,
                  status: 'PLANNING',
                  progress: 0,
                  summary: `${contract.proposal.title} project initiated`,
                },
              });
            }

            return tx.contract.findUnique({
              where: { id: updatedContract.id },
              include: {
                proposal: {
                  include: {
                    lead: {
                      include: {
                        client: true,
                      },
                    },
                  },
                },
                project: true,
              },
            });
          })
          .then(async (result) => {
            const eventDate = contract.proposal.lead.eventDate;
            const countdownDays = [7, 3, 1];
            for (const daysRemaining of countdownDays) {
              const reminderAt =
                eventDate.getTime() - daysRemaining * 24 * 60 * 60 * 1000;
              if (reminderAt > Date.now() && result?.project?.id) {
                await this.queueService.queueReminder(
                  {
                    kind: 'event-countdown',
                    projectId: result.project.id,
                    daysRemaining,
                  },
                  {
                    delay: reminderAt - Date.now(),
                    jobId: `event-countdown:${result.project.id}:${daysRemaining}`,
                  },
                );
              }
            }

            await this.notificationsService.createInApp({
              userId: user.userId,
              type: 'CONTRACT',
              title: 'Contract signed successfully',
              body: 'Your signature has been recorded. Our operations team will move your event into execution planning.',
              actionUrl: `/dashboard/events/${contract.proposal.leadId}`,
              metadata: {
                contractId: id,
                leadId: contract.proposal.leadId,
              },
            });

            if (result?.proposal.lead.client.email) {
              await this.queueService.queueEmail({
                to: result.proposal.lead.client.email,
                subject: 'Contract signed',
                template: 'contract-signed',
                emailType: 'CONTRACT_SIGNED',
                recipientUserId: result.proposal.lead.clientId,
                requestedById: user.userId,
                leadId: contract.proposal.leadId,
                contractId: id,
                variables: {
                  signerName: dto.signerName.trim(),
                  contractId: id,
                },
              });
            }
            return result;
          }),
    });
  }

  async createDocumentUploadUrl(
    contractId: string,
    dto: CreateUploadUrlDto,
    user: AuthUser,
  ) {
    const contract = await this.getContractForUser(contractId, user, {
      allowClient: true,
    });

    this.storageService.validateUpload(dto.contentType, dto.sizeBytes);

    const nextVersion = (contract.versions[0]?.version ?? 0) + 1;
    const key = `contracts/${contractId}/v${nextVersion}/${this.sanitizeFileName(dto.fileName)}`;
    const upload = await this.storageService.createUploadUrl(
      key,
      dto.contentType,
    );

    await this.prisma.contractDocumentVersion.create({
      data: {
        contractId,
        fileKey: key,
        version: nextVersion,
        uploadedBy: user.userId,
      },
    });

    await this.prisma.contract.update({
      where: { id: contractId },
      data: {
        documentUrl: upload.fileUrl,
      },
    });

    await this.auditService.log({
      action: AuditAction.FILE_UPLOADED,
      entityType: 'Contract',
      entityId: contractId,
      userId: user.userId,
      metadata: {
        key,
        version: nextVersion,
      },
    });

    return upload;
  }

  async listVersions(id: string, user: AuthUser) {
    const contract = await this.getContractForUser(id, user, {
      allowClient: true,
    });
    const uploaderIds = contract.versions
      .map((version) => version.uploadedBy)
      .filter((value): value is string => Boolean(value));

    const uploaders = uploaderIds.length
      ? await this.prisma.user.findMany({
          where: {
            id: {
              in: uploaderIds,
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        })
      : [];

    const uploaderMap = new Map(
      uploaders.map((uploader) => [
        uploader.id,
        uploader.name || uploader.email || uploader.phone || uploader.id,
      ]),
    );

    return Promise.all(
      contract.versions.map(async (version, index) => {
        const access = await this.storageService.createDownloadUrl(
          version.fileKey,
        );
        return {
          id: version.id,
          version: version.version,
          createdAt: version.createdAt,
          uploadedBy: version.uploadedBy,
          uploadedByLabel: version.uploadedBy
            ? (uploaderMap.get(version.uploadedBy) ?? version.uploadedBy)
            : 'System',
          accessUrl: access.url,
          isCurrent: index === 0,
        };
      }),
    );
  }

  async createDocumentAccessUrl(id: string, user: AuthUser) {
    const contract = await this.getContractForUser(id, user, {
      allowClient: true,
    });
    const latestVersion = contract.versions[0];

    if (latestVersion) {
      return this.storageService.createDownloadUrl(latestVersion.fileKey);
    }

    return {
      key: null,
      url: contract.documentUrl,
      expiresIn: null,
    };
  }

  private async ensureContract(id: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id } });
    if (!contract) {
      throw new NotFoundException('Contract not found.');
    }
    return contract;
  }

  private async loadTemplateProposal(proposalId: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        lead: {
          include: {
            client: true,
          },
        },
        contract: true,
      },
    });

    if (!proposal || proposal.deletedAt) {
      throw new NotFoundException('Proposal not found.');
    }

    if (proposal.status !== ProposalStatus.ACCEPTED) {
      throw new BadRequestException(
        'Contract templates can only be used for accepted proposals.',
      );
    }

    return proposal;
  }

  private async createContractRecord(input: {
    proposalId: string;
    documentUrl: string;
    status: ContractStatus;
    actorId?: string;
    versionKey?: string;
  }) {
    if (input.status === ContractStatus.ARCHIVED) {
      throw new BadRequestException(
        'Contracts cannot be created directly in archived status.',
      );
    }

    const proposal = await this.prisma.proposal.findUnique({
      where: { id: input.proposalId },
      include: {
        contract: true,
        lead: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found.');
    }

    if (proposal.status !== ProposalStatus.ACCEPTED) {
      throw new BadRequestException(
        'A contract can only be created for an accepted proposal.',
      );
    }

    if (proposal.contract) {
      throw new BadRequestException(
        'Contract already exists for this proposal.',
      );
    }

    const derivedVersionKey =
      input.versionKey ??
      this.storageService.extractKeyFromFileUrl(input.documentUrl) ??
      undefined;

    const contract = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contract.create({
        data: {
          proposalId: input.proposalId,
          documentUrl: input.documentUrl,
          status: input.status,
        },
        include: {
          proposal: {
            include: {
              lead: {
                include: {
                  client: true,
                },
              },
            },
          },
          project: true,
        },
      });

      if (derivedVersionKey) {
        await tx.contractDocumentVersion.create({
          data: {
            contractId: created.id,
            fileKey: derivedVersionKey,
            version: 1,
            uploadedBy: input.actorId,
          },
        });
      }

      return created;
    });

    await this.leadsService.recordContractCreated(
      proposal.leadId,
      input.actorId,
      contract.id,
    );
    await this.notificationsService.createInApp({
      userId: proposal.lead.clientId,
      type: 'CONTRACT',
      title: 'Contract ready for signature',
      body: 'Your event contract is ready. Review the terms and sign to confirm the event.',
      actionUrl: `/dashboard/events/${proposal.leadId}`,
      metadata: {
        contractId: contract.id,
        leadId: proposal.leadId,
      },
    });

    if (contract.proposal.lead.client.email) {
      await this.queueService.queueEmail({
        to: contract.proposal.lead.client.email,
        subject: 'Contract ready for signature',
        template: 'contract-ready',
        emailType: 'CONTRACT_READY',
        recipientUserId: contract.proposal.lead.clientId,
        requestedById: input.actorId,
        leadId: proposal.leadId,
        proposalId: proposal.id,
        contractId: contract.id,
        variables: {
          title: contract.proposal.title,
          contractId: contract.id,
        },
      });
    }

    return contract;
  }

  private async getContractForUser(
    id: string,
    user: AuthUser,
    options?: { allowClient?: boolean },
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        proposal: {
          include: {
            lead: {
              include: {
                client: true,
              },
            },
          },
        },
        versions: {
          orderBy: { version: 'desc' },
        },
        project: true,
      },
    });

    if (!contract || contract.deletedAt) {
      throw new NotFoundException('Contract not found.');
    }

    if (isStaffRole(user.role)) {
      return contract;
    }

    if (
      options?.allowClient &&
      user.role === Role.CLIENT &&
      contract.proposal.lead.clientId === user.userId
    ) {
      return contract;
    }

    if (isAdminRole(user.role)) {
      return contract;
    }

    throw new ForbiddenException('You cannot access this contract.');
  }

  private sanitizeFileName(fileName: string) {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
  }
}
