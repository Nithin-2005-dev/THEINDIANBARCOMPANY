import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LeadsService } from './leads.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

describe('LeadsService', () => {
  let service: LeadsService;

  const prisma = {
    user: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    lead: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const idempotencyService = {
    execute: jest.fn(),
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

  const configService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    idempotencyService.execute.mockImplementation(
      async ({ execute }: { execute: () => Promise<unknown> }) => execute(),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: IdempotencyService,
          useValue: idempotencyService,
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
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects offline bookings when the submitted phone is already linked to a different email on the client account', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'client-1',
        name: 'Existing Client',
        phone: '+918179133593',
        email: 'old@example.com',
        role: Role.CLIENT,
      },
    ]);

    await expect(
      service.createOfflineBooking(
        {
          clientName: 'New Name',
          clientEmail: 'new@example.com',
          clientPhone: '8179133593',
          eventType: 'House Party',
          location: 'Hyderabad',
          eventDate: '2026-05-10T18:30:00.000Z',
        },
        {
          userId: 'admin-1',
          role: Role.ADMIN,
          sessionId: 'session-1',
        },
      ),
    ).rejects.toThrow(
      'That phone number and email must already belong to the same client account.',
    );

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
