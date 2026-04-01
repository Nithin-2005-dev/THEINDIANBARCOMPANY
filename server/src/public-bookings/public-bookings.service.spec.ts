import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentRole, AuditAction, LeadStatus, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { PublicBookingsService } from './public-bookings.service';

describe('PublicBookingsService', () => {
  let service: PublicBookingsService;

  type PublicBookingTransaction = {
    lead: {
      create: jest.Mock;
    };
    leadStatusHistory: {
      create: jest.Mock;
    };
    leadActivity: {
      create: jest.Mock;
    };
    conversationThread: {
      createMany: jest.Mock;
    };
    leadAssignment: {
      createMany: jest.Mock;
    };
  };

  const prisma = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const auditService = {
    log: jest.fn(),
  };

  const notificationsService = {
    createInApp: jest.fn(),
  };

  const queueService = {
    queueEmail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicBookingsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
        {
          provide: QueueService,
          useValue: queueService,
        },
      ],
    }).compile();

    service = module.get<PublicBookingsService>(PublicBookingsService);
  });

  it('queues confirmation emails for the client and active admins', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'client-1',
      name: 'Riya Malhotra',
      phone: '+919876543210',
      email: 'riya@example.com',
      role: Role.CLIENT,
    });
    prisma.user.findMany.mockResolvedValue([
      { id: 'admin-1', email: 'admin@example.com' },
      { id: 'admin-2', email: 'ADMIN@example.com' },
      { id: 'admin-3', email: 'ops@example.com' },
    ]);
    const leadAssignmentCreateMany = jest.fn().mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation(
      (callback: (tx: PublicBookingTransaction) => Promise<unknown>) =>
        callback({
          lead: {
            create: jest.fn().mockResolvedValue({
              id: 'lead-1',
              status: LeadStatus.NEW,
            }),
          },
          leadStatusHistory: {
            create: jest.fn().mockResolvedValue(undefined),
          },
          leadActivity: {
            create: jest.fn().mockResolvedValue(undefined),
          },
          conversationThread: {
            createMany: jest.fn().mockResolvedValue(undefined),
          },
          leadAssignment: {
            createMany: leadAssignmentCreateMany,
          },
        }),
    );

    const result = await service.create({
      name: 'Riya Malhotra',
      phone: '+919876543210',
      email: 'riya@example.com',
      eventType: 'House Party',
      location: 'Bandra, Mumbai',
      city: 'Mumbai',
      packageName: 'Signature Cocktail Service',
      packageLabel: 'Signature Cocktail Service for 60 guests',
      addOns: ['Molecular cocktails'],
      eventDate: '2026-05-10T18:30:00.000Z',
      guestCount: 60,
      budgetMin: 60000,
      budgetMax: 120000,
      notes: 'Need a smoked-cocktail ritual at welcome hour.',
    });

    expect(result).toEqual({
      id: 'lead-1',
      status: LeadStatus.NEW,
      clientId: 'client-1',
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.LEAD_CREATED,
        entityId: 'lead-1',
        userId: 'client-1',
      }),
    );
    expect(leadAssignmentCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          leadId: 'lead-1',
          userId: 'admin-1',
          role: AssignmentRole.PRIMARY,
        }),
        expect.objectContaining({
          leadId: 'lead-1',
          userId: 'admin-2',
          role: AssignmentRole.SUPPORTING,
        }),
        expect.objectContaining({
          leadId: 'lead-1',
          userId: 'admin-3',
          role: AssignmentRole.SUPPORTING,
        }),
      ],
      skipDuplicates: true,
    });
    expect(notificationsService.createInApp).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: 'client-1',
        actionUrl: '/dashboard/events/lead-1',
      }),
    );
    expect(notificationsService.createInApp).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: 'admin-1',
        actionUrl: '/admin/chat?leadId=lead-1&conversationType=GROUP',
      }),
    );
    expect(notificationsService.createInApp).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        userId: 'admin-2',
        actionUrl: '/admin/chat?leadId=lead-1&conversationType=GROUP',
      }),
    );
    expect(notificationsService.createInApp).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        userId: 'admin-3',
        actionUrl: '/admin/chat?leadId=lead-1&conversationType=GROUP',
      }),
    );
    expect(queueService.queueEmail).toHaveBeenCalledTimes(3);
    expect(queueService.queueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'riya@example.com',
        template: 'lead-confirmation',
      }),
    );
    expect(queueService.queueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        template: 'lead-admin-notification',
      }),
    );
    expect(queueService.queueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ops@example.com',
        template: 'lead-admin-notification',
      }),
    );
  });
});
