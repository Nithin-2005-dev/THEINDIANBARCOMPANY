import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendEmail(params: {
    to: string;
    subject: string;
    template: string;
    variables?: Record<string, unknown>;
  }) {
    const provider = this.configService.get<string>('EMAIL_PROVIDER', 'mock');
    this.logger.log(
      JSON.stringify({
        provider,
        ...params,
      }),
    );

    return {
      delivered: true,
      provider,
    };
  }
}
