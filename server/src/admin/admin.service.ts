import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async analytics() {
    const [
      totalUsers,
      totalClients,
      totalVendors,
      totalLeads,
      totalProjects,
      totalPayments,
      paidRevenue,
      leadsByStatus,
      projectsByStatus,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'CLIENT' } }),
      this.prisma.vendor.count(),
      this.prisma.lead.count(),
      this.prisma.project.count(),
      this.prisma.payment.count(),
      this.prisma.payment.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true },
      }),
      this.prisma.lead.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.project.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    return {
      totals: {
        users: totalUsers,
        clients: totalClients,
        vendors: totalVendors,
        leads: totalLeads,
        projects: totalProjects,
        payments: totalPayments,
        revenuePaid: paidRevenue._sum.amount ?? 0,
      },
      leadsByStatus,
      projectsByStatus,
    };
  }

  async pipeline() {
    const leads = await this.prisma.lead.findMany({
      include: {
        client: true,
        proposals: {
          include: {
            contract: {
              include: {
                project: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return leads;
  }

  async systemOverview() {
    const [activeSessions, suspiciousSessions, pendingOtpChallenges, queueHealth] =
      await Promise.all([
        this.prisma.session.count({ where: { status: 'ACTIVE' } }),
        this.prisma.session.count({ where: { status: 'SUSPICIOUS' } }),
        this.prisma.otpChallenge.count({ where: { status: 'PENDING' } }),
        this.queueService.getQueueHealth(),
      ]);

    return {
      sessions: {
        active: activeSessions,
        suspicious: suspiciousSessions,
      },
      otpChallenges: {
        pending: pendingOtpChallenges,
      },
      queues: queueHealth,
    };
  }

  async revokeSession(sessionId: string, reason: string) {
    const session = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        suspiciousReason: reason,
      },
    });

    return {
      message: 'Session revoked.',
      sessionId: session.id,
    };
  }
}
