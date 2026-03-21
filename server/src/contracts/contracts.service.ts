import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, ContractStatus, ProposalStatus, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractStatusDto } from './dto/update-contract-status.dto';
import { CreateUploadUrlDto } from '../storage/dto/create-upload-url.dto';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async create(dto: CreateContractDto, idempotencyKey?: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: dto.proposalId },
      include: { contract: true, lead: true },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found.');
    }

    if (proposal.status !== ProposalStatus.ACCEPTED) {
      throw new BadRequestException('A contract can only be created for an accepted proposal.');
    }

    if (proposal.contract) {
      throw new BadRequestException('Contract already exists for this proposal.');
    }

    return this.idempotencyService.execute({
      key: idempotencyKey,
      scope: `contract:create:${dto.proposalId}`,
      userId: proposal.lead.clientId,
      request: dto,
      execute: () =>
        this.prisma.$transaction((tx) =>
          tx.contract.create({
            data: {
              ...dto,
              status: dto.status ?? ContractStatus.SENT,
            },
            include: {
              proposal: {
                include: {
                  lead: true,
                },
              },
            },
          }),
        ),
    });
  }

  async listForUser(user: AuthUser) {
    return this.prisma.contract.findMany({
      where: user.role === Role.ADMIN ? {} : { proposal: { lead: { clientId: user.userId } } },
      include: {
        proposal: {
          include: {
            lead: true,
          },
        },
        project: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, dto: UpdateContractStatusDto) {
    await this.ensureContract(id);

    return this.prisma.contract.update({
      where: { id },
      data: {
        status: dto.status,
        signedAt: dto.status === ContractStatus.SIGNED ? new Date() : null,
      },
      include: {
        proposal: {
          include: {
            lead: true,
          },
        },
        project: true,
      },
    });
  }

  async sign(id: string, user: AuthUser, idempotencyKey?: string) {
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

    return this.idempotencyService.execute({
      key: idempotencyKey,
      scope: `contract:sign:${id}`,
      userId: user.userId,
      request: { id },
      execute: () =>
        this.prisma.$transaction(async (tx) => {
          const updatedContract = await tx.contract.update({
            where: { id },
            data: {
              status: ContractStatus.SIGNED,
              signedAt: new Date(),
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
                  lead: true,
                },
              },
              project: true,
            },
          });
        }),
    });
  }

  async createDocumentUploadUrl(contractId: string, dto: CreateUploadUrlDto, user: AuthUser) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        proposal: {
          include: {
            lead: true,
          },
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!contract || contract.deletedAt) {
      throw new NotFoundException('Contract not found.');
    }

    if (user.role !== Role.ADMIN && contract.proposal.lead.clientId !== user.userId) {
      throw new ForbiddenException('You cannot upload documents for this contract.');
    }

    this.storageService.validateUpload(dto.contentType, dto.sizeBytes);

    const nextVersion = (contract.versions[0]?.version ?? 0) + 1;
    const key = `contracts/${contractId}/v${nextVersion}/${dto.fileName}`;
    const upload = await this.storageService.createUploadUrl(key, dto.contentType);

    await this.prisma.contractDocumentVersion.create({
      data: {
        contractId,
        fileKey: key,
        version: nextVersion,
        uploadedBy: user.userId,
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

  private async ensureContract(id: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id } });
    if (!contract) {
      throw new NotFoundException('Contract not found.');
    }
    return contract;
  }
}
