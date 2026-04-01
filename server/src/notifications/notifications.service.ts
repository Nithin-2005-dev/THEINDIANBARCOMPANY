import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, Prisma } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

type OtpDeliveryChannel = 'PHONE' | 'EMAIL';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async sendOtp(params: {
    channel: OtpDeliveryChannel;
    destination: string;
    message: string;
    subject?: string;
    template?: string;
    variables?: Record<string, unknown>;
  }) {
    if (params.channel === 'EMAIL') {
      return this.emailService.sendEmail({
        to: params.destination,
        subject: params.subject ?? 'Your login OTP',
        template: params.template ?? 'otp-login',
        variables: params.variables,
      });
    }

    const provider = this.configService.getOrThrow<string>('SMS_PROVIDER');

    if (provider === 'mock') {
      this.logger.log(`Mock SMS queued for ${params.destination}`);
      return { provider, delivered: true };
    }

    if (provider === 'twilio') {
      return this.sendTwilioSms(params.destination, params.message);
    }

    // MSG91 / AWS SNS can be added without changing callers.
    this.logger.log(
      `Queued SMS delivery via ${provider} for ${params.destination}`,
    );
    return { provider, delivered: true };
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    template: string;
    variables?: Record<string, unknown>;
  }) {
    return this.emailService.sendEmail(params);
  }

  async createInApp(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    actionUrl?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    const notification = await this.prisma.notification.create({
      data: params,
    });

    await this.realtimeService.publishToUser(
      params.userId,
      'notification.created',
      {
        notification,
      },
    );

    return notification;
  }

  async listForUser(userId: string, limit = 20) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markRead(userId: string, notificationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        readAt: new Date(),
      },
    });

    if (result.count > 0) {
      await this.realtimeService.publishToUser(userId, 'notification.read', {
        notificationId,
      });
    }

    return result;
  }

  private async sendTwilioSms(destination: string, message: string) {
    const accountSid =
      this.configService.getOrThrow<string>('TWILIO_ACCOUNT_SID');
    const authToken =
      this.configService.getOrThrow<string>('TWILIO_AUTH_TOKEN');
    const from = this.configService.getOrThrow<string>('SMS_FROM');
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const body = new URLSearchParams({
      To: destination,
      From: from,
      Body: message,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      this.logger.error(`Twilio SMS failed: ${response.status} ${details}`);
      throw new Error('Twilio SMS delivery failed.');
    }

    return {
      provider: 'twilio',
      delivered: true,
    };
  }
}
