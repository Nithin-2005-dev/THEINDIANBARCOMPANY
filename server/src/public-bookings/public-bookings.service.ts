import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssignmentRole,
  AuditAction,
  ConversationThreadType,
  LeadActivityType,
  LeadStatus,
  Role,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  normalizeEmailContact,
  normalizePhoneContact,
  resolveClientUserFromContacts,
} from '../common/utils/contact-identity';
import { buildClientPortalLoginUrl } from '../common/utils/client-portal-url';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreatePublicBookingDto } from './dto/create-public-booking.dto';

@Injectable()
export class PublicBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreatePublicBookingDto) {
    if (
      dto.budgetMin !== undefined &&
      dto.budgetMax !== undefined &&
      dto.budgetMin > dto.budgetMax
    ) {
      throw new BadRequestException(
        'budgetMin cannot be greater than budgetMax.',
      );
    }

    const normalizedName = dto.name.trim();
    const normalizedPhone = normalizePhoneContact(dto.phone);
    const normalizedEmail = normalizeEmailContact(dto.email);

    const matchingUsers = await this.prisma.user.findMany({
      where: {
        OR: [
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ],
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const existingUser = resolveClientUserFromContacts({
      matchingUsers,
      phone: normalizedPhone,
      email: normalizedEmail,
    });

    const user = existingUser
      ? await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: normalizedName,
            phone: existingUser.phone ?? normalizedPhone,
            email: existingUser.email ?? normalizedEmail,
          },
        })
      : await this.prisma.user.create({
          data: {
            name: normalizedName,
            phone: normalizedPhone,
            email: normalizedEmail,
            role: Role.CLIENT,
          },
        });

    const eventDate = new Date(dto.eventDate);
    const activeAdmins = await this.prisma.user.findMany({
      where: {
        role: Role.ADMIN,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const lead = await this.prisma.$transaction(async (tx) => {
      const createdLead = await tx.lead.create({
        data: {
          clientId: user.id,
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
      });

      await tx.leadStatusHistory.create({
        data: {
          leadId: createdLead.id,
          oldStatus: null,
          newStatus: createdLead.status,
          changedById: user.id,
        },
      });

      await tx.leadActivity.create({
        data: {
          leadId: createdLead.id,
          type: LeadActivityType.MANUAL_ACTION,
          actorId: user.id,
          description: 'Booking request submitted',
          metadata: {
            packageName: dto.packageName,
            addOns: dto.addOns ?? [],
          },
        },
      });

      await tx.conversationThread.createMany({
        data: this.buildDefaultConversationThreads(createdLead.id),
        skipDuplicates: true,
      });

      if (activeAdmins.length) {
        await tx.leadAssignment.createMany({
          data: activeAdmins.map((admin, index) => ({
            leadId: createdLead.id,
            userId: admin.id,
            role:
              index === 0 ? AssignmentRole.PRIMARY : AssignmentRole.SUPPORTING,
            notes: 'Auto-assigned from public booking submission.',
          })),
          skipDuplicates: true,
        });
      }

      return createdLead;
    });

    await this.auditService.log({
      action: AuditAction.LEAD_CREATED,
      entityType: 'Lead',
      entityId: lead.id,
      userId: user.id,
      metadata: {
        source: 'public_booking',
      },
    });

    await this.notificationsService.createInApp({
      userId: user.id,
      type: 'GENERAL',
      title: 'Booking request received',
      body: 'Your event brief is with our sales team. You can verify your phone and track updates in the client dashboard.',
      actionUrl: `/dashboard/events/${lead.id}`,
      metadata: {
        leadId: lead.id,
      },
    });

    const adminEmails: string[] = [];
    const seenAdminEmails = new Set<string>();

    for (const admin of activeAdmins) {
      const email = admin.email?.trim();
      if (!email) {
        continue;
      }

      const normalizedEmail = email.toLowerCase();
      if (seenAdminEmails.has(normalizedEmail)) {
        continue;
      }

      seenAdminEmails.add(normalizedEmail);
      adminEmails.push(email);
    }

    await Promise.all([
      ...activeAdmins.map((admin) =>
        this.notificationsService.createInApp({
          userId: admin.id,
          type: 'GENERAL',
          title: 'New booking request',
          body: `${user.name ?? dto.name} requested ${dto.eventType} for ${this.formatEventDate(eventDate)}.`,
          actionUrl: `/admin/chat?leadId=${lead.id}&conversationType=GROUP`,
          metadata: {
            leadId: lead.id,
            source: 'public_booking',
          },
        }),
      ),
      ...(user.email
        ? [
            this.queueService.queueEmail({
              to: user.email,
              subject: 'Thank you for your event request',
              template: 'lead-confirmation',
              emailType: 'BOOKING_CONFIRMATION',
              recipientUserId: user.id,
              leadId: lead.id,
              variables: {
                clientName: user.name ?? dto.name,
                eventType: dto.eventType,
                location: dto.location,
                eventDate: this.formatEventDate(eventDate),
                service: dto.packageLabel ?? dto.packageName ?? dto.eventType,
                leadId: lead.id,
                accessEmail: user.email ?? dto.email ?? '',
                accessPhone: user.phone ?? dto.phone,
                portalUrl: this.buildPortalUrl(lead.id),
              },
            }),
          ]
        : []),
      ...adminEmails.map((email) =>
        this.queueService.queueEmail({
          to: email,
          subject: `New booking request: ${dto.eventType}`,
          template: 'lead-admin-notification',
          emailType: 'ADMIN_ALERT',
          leadId: lead.id,
          variables: {
            clientName: user.name ?? dto.name,
            clientPhone: user.phone ?? dto.phone,
            clientEmail: user.email ?? dto.email ?? 'Not provided',
            eventType: dto.eventType,
            location: dto.location,
            city: dto.city ?? 'Not provided',
            eventDate: this.formatEventDate(eventDate),
            service: dto.packageLabel ?? dto.packageName ?? dto.eventType,
            guestCount: dto.guestCount ?? 'Not provided',
            budgetRange: this.formatBudgetRange(dto.budgetMin, dto.budgetMax),
            addOns:
              dto.addOns && dto.addOns.length > 0
                ? dto.addOns.join(', ')
                : 'None selected',
            notes: dto.notes?.trim() || 'No extra notes',
            leadId: lead.id,
            adminUrl: this.buildAdminPortalUrl(lead.id),
          },
        }),
      ),
    ]);

    return {
      id: lead.id,
      status: lead.status,
      clientId: user.id,
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

  private formatEventDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private formatBudgetRange(min?: number, max?: number) {
    const currency = new Intl.NumberFormat('en-IN');
    const formatAmount = (amount: number) => `INR ${currency.format(amount)}`;

    if (min !== undefined && max !== undefined) {
      return `${formatAmount(min)} - ${formatAmount(max)}`;
    }

    if (min !== undefined) {
      return `From ${formatAmount(min)}`;
    }

    if (max !== undefined) {
      return `Up to ${formatAmount(max)}`;
    }

    return 'Not provided';
  }

  private buildPortalUrl(leadId: string) {
    const siteUrl =
      this.configService.get<string>('NEXT_PUBLIC_SITE_URL')?.trim() ||
      this.configService.get<string>('FRONTEND_APP_URL')?.trim();

    return buildClientPortalLoginUrl(siteUrl, `/dashboard/events/${leadId}`);
  }

  private buildAdminPortalUrl(leadId: string) {
    const siteUrl =
      this.configService.get<string>('NEXT_PUBLIC_SITE_URL')?.trim() ||
      this.configService.get<string>('FRONTEND_APP_URL')?.trim();

    if (!siteUrl) {
      return '';
    }

    try {
      const url = new URL('/login', siteUrl);
      url.searchParams.set('role', 'admin');
      url.searchParams.set(
        'next',
        `/admin/chat?leadId=${leadId}&conversationType=GROUP`,
      );
      return url.toString();
    } catch {
      return '';
    }
  }
}
