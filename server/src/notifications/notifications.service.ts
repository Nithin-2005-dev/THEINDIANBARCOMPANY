import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async sendOtp(phone: string, message: string) {
    const provider = this.configService.getOrThrow<string>('SMS_PROVIDER');

    if (provider === 'mock') {
      this.logger.log(`Mock SMS to ${phone}: ${message}`);
      return { provider, delivered: true };
    }

    // Provider abstraction point for Twilio / MSG91 / AWS SNS integrations.
    this.logger.log(`Queued SMS delivery via ${provider} for ${phone}`);
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
}
