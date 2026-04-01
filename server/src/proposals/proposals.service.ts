import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeadStatus, Prisma, ProposalStatus } from '@prisma/client';
import { LeadsService } from '../leads/leads.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { ListProposalsQueryDto } from './dto/list-proposals-query.dto';
import { ProposalDecisionDto } from './dto/proposal-decision.dto';
import { isStaffRole } from '../common/auth/role-helpers';

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsService: LeadsService,
    private readonly notificationsService: NotificationsService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateProposalDto, actorId?: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: dto.leadId },
      include: {
        client: true,
      },
    });

    if (!lead || lead.deletedAt) {
      throw new NotFoundException('Lead not found.');
    }

    const proposalStatus = dto.status ?? ProposalStatus.SENT;

    const proposal = await this.prisma.$transaction(async (tx) => {
      const createdProposal = await tx.proposal.create({
        data: {
          ...dto,
          status: proposalStatus,
        },
        include: {
          lead: true,
        },
      });

      if (proposalStatus === ProposalStatus.SENT) {
        await this.leadsService.syncLeadStatus(
          dto.leadId,
          LeadStatus.PROPOSAL_SENT,
          {
            actorId,
            tx,
            description: 'Proposal sent to client',
            metadata: {
              proposalId: createdProposal.id,
              proposalStatus,
            },
          },
        );
      }

      return createdProposal;
    });

    await this.leadsService.recordProposalCreated(
      dto.leadId,
      actorId,
      proposal.id,
    );
    await this.notificationsService.createInApp({
      userId: lead.clientId,
      type: 'PROPOSAL',
      title: 'New proposal ready',
      body: `${proposal.title} is ready for your review.`,
      actionUrl: `/dashboard/events/${lead.id}`,
      metadata: {
        leadId: lead.id,
        proposalId: proposal.id,
      },
    });

    if (lead.client.email) {
      await this.queueService.queueEmail({
        to: lead.client.email,
        subject: `${proposal.title} is ready for review`,
        template: 'proposal-sent',
        variables: {
          title: proposal.title,
          amount: proposal.price,
          leadId: lead.id,
          clientName:
            lead.client.name ??
            lead.client.email ??
            lead.client.phone ??
            'there',
          eventType: lead.eventType,
          eventDate: lead.eventDate.toISOString().slice(0, 10),
          timeline: proposal.timeline,
          loginIdentifier: lead.client.email ?? lead.client.phone ?? '',
          portalUrl: this.buildPortalUrl(lead.id),
        },
      });
    }
    return proposal;
  }

  async listForUser(user: AuthUser, query: ListProposalsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ProposalWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
      deletedAt: null,
      ...(isStaffRole(user.role) ? {} : { lead: { clientId: user.userId } }),
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
      throw new BadRequestException(
        'Clients can only accept or reject a proposal.',
      );
    }

    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        contract: true,
        lead: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!proposal || proposal.deletedAt) {
      throw new NotFoundException('Proposal not found.');
    }

    if (proposal.lead.clientId !== user.userId) {
      throw new ForbiddenException('You cannot act on this proposal.');
    }

    if (dto.status === ProposalStatus.ACCEPTED) {
      return this.prisma
        .$transaction(async (tx) => {
          const accepted = await tx.proposal.findFirst({
            where: {
              leadId: proposal.leadId,
              status: ProposalStatus.ACCEPTED,
              id: { not: proposalId },
            },
          });

          if (accepted) {
            throw new BadRequestException(
              'This lead already has an accepted proposal.',
            );
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

          await this.leadsService.syncLeadStatus(
            proposal.leadId,
            LeadStatus.WON,
            {
              actorId: user.userId,
              tx,
              description: 'Proposal accepted by client',
              metadata: {
                proposalId,
                proposalStatus: ProposalStatus.ACCEPTED,
              },
            },
          );

          return tx.proposal.update({
            where: { id: proposalId },
            data: {
              status: ProposalStatus.ACCEPTED,
              clientComment: dto.comment,
              decidedAt: new Date(),
            },
            include: { lead: true, contract: true },
          });
        })
        .then(async (acceptedProposal) => {
          await this.notificationsService.createInApp({
            userId: proposal.lead.clientId,
            type: 'PROPOSAL',
            title: 'Proposal accepted',
            body: 'Your proposal has been accepted and contract preparation can continue.',
            actionUrl: `/dashboard/events/${proposal.leadId}`,
            metadata: {
              leadId: proposal.leadId,
              proposalId,
              status: ProposalStatus.ACCEPTED,
            },
          });

          if (proposal.lead.client.email) {
            await this.queueService.queueEmail({
              to: proposal.lead.client.email,
              subject: 'Proposal accepted',
              template: 'proposal-accepted',
              variables: {
                title: proposal.title,
                comment: dto.comment,
              },
            });
          }

          return acceptedProposal;
        });
    }

    const rejectedProposal = await this.prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: ProposalStatus.REJECTED,
        clientComment: dto.comment,
        decidedAt: new Date(),
      },
      include: { lead: true, contract: true },
    });

    const remainingActive = await this.prisma.proposal.count({
      where: {
        leadId: proposal.leadId,
        status: {
          in: [
            ProposalStatus.SENT,
            ProposalStatus.DRAFT,
            ProposalStatus.ACCEPTED,
          ],
        },
      },
    });

    if (remainingActive === 0) {
      await this.leadsService.syncLeadStatus(proposal.leadId, LeadStatus.LOST, {
        actorId: user.userId,
        description: 'Lead marked lost after proposal rejection',
        metadata: {
          proposalId,
          proposalStatus: ProposalStatus.REJECTED,
        },
      });
    }

    await this.notificationsService.createInApp({
      userId: proposal.lead.clientId,
      type: 'PROPOSAL',
      title: 'Proposal declined',
      body: 'You declined the proposal. Our team can revise the scope if needed.',
      actionUrl: `/dashboard/events/${proposal.leadId}`,
      metadata: {
        leadId: proposal.leadId,
        proposalId,
        status: dto.status,
      },
    });

    const client = await this.prisma.user.findUnique({
      where: { id: proposal.lead.clientId },
      select: { email: true },
    });

    if (client?.email) {
      await this.queueService.queueEmail({
        to: client.email,
        subject: 'Proposal decision received',
        template: 'proposal-rejected',
        variables: {
          title: proposal.title,
          comment: dto.comment,
        },
      });
    }

    return rejectedProposal;
  }

  private buildPortalUrl(leadId: string) {
    const siteUrl =
      this.configService.get<string>('NEXT_PUBLIC_SITE_URL')?.trim() ||
      this.configService.get<string>('FRONTEND_APP_URL')?.trim();

    if (!siteUrl) {
      return '';
    }

    try {
      const nextPath = `/dashboard/events/${leadId}`;
      const url = new URL('/login', siteUrl);
      url.searchParams.set('role', 'client');
      url.searchParams.set('next', nextPath);
      return url.toString();
    } catch {
      return '';
    }
  }
}
