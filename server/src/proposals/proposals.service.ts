import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeadStatus, Prisma, ProposalStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { ListProposalsQueryDto } from './dto/list-proposals-query.dto';
import { ProposalDecisionDto } from './dto/proposal-decision.dto';

@Injectable()
export class ProposalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProposalDto) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: dto.leadId },
    });

    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Lead not found.');
    }

    return this.prisma.proposal.create({
      data: {
        ...dto,
        status: dto.status ?? ProposalStatus.SENT,
      },
      include: {
        lead: true,
      },
    });
  }

  async listForUser(user: AuthUser, query: ListProposalsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ProposalWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
      deletedAt: null,
      ...(user.role === Role.ADMIN ? {} : { lead: { clientId: user.userId } }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.proposal.findMany({
        where,
        include: {
          lead: true,
          contract: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.proposal.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total },
    };
  }

  async decide(proposalId: string, dto: ProposalDecisionDto, user: AuthUser) {
    if (
      dto.status !== ProposalStatus.ACCEPTED &&
      dto.status !== ProposalStatus.REJECTED
    ) {
      throw new BadRequestException('Clients can only accept or reject a proposal.');
    }

    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        lead: true,
        contract: true,
      },
    });

    if (!proposal || proposal.deletedAt) {
      throw new NotFoundException('Proposal not found.');
    }

    if (proposal.lead.clientId !== user.userId) {
      throw new ForbiddenException('You cannot act on this proposal.');
    }

    if (dto.status === ProposalStatus.ACCEPTED) {
      return this.prisma.$transaction(async (tx) => {
        const accepted = await tx.proposal.findFirst({
          where: {
            leadId: proposal.leadId,
            status: ProposalStatus.ACCEPTED,
            id: { not: proposalId },
          },
        });

        if (accepted) {
          throw new BadRequestException('This lead already has an accepted proposal.');
        }

        await tx.proposal.updateMany({
          where: {
            leadId: proposal.leadId,
            id: { not: proposalId },
            status: { in: [ProposalStatus.SENT, ProposalStatus.DRAFT] },
          },
          data: {
            status: ProposalStatus.REJECTED,
          },
        });

        await tx.lead.update({
          where: { id: proposal.leadId },
          data: { status: LeadStatus.WON },
        });

        return tx.proposal.update({
          where: { id: proposalId },
          data: { status: ProposalStatus.ACCEPTED },
          include: { lead: true, contract: true },
        });
      });
    }

    const rejectedProposal = await this.prisma.proposal.update({
      where: { id: proposalId },
      data: { status: ProposalStatus.REJECTED },
      include: { lead: true, contract: true },
    });

    const remainingActive = await this.prisma.proposal.count({
      where: {
        leadId: proposal.leadId,
        status: { in: [ProposalStatus.SENT, ProposalStatus.DRAFT, ProposalStatus.ACCEPTED] },
      },
    });

    if (remainingActive === 0) {
      await this.prisma.lead.update({
        where: { id: proposal.leadId },
        data: { status: LeadStatus.LOST },
      });
    }

    return rejectedProposal;
  }
}
