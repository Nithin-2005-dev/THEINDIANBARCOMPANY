import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { renderEmailTemplate } from './email.templates';
import type { EmailDispatchResult } from './email.types';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendEmail(params: {
    to: string;
    subject: string;
    template: string;
    variables?: Record<string, unknown>;
  }): Promise<EmailDispatchResult> {
    const provider = this.configService.get<string>('EMAIL_PROVIDER', 'mock');
    const from = this.configService.get<string>('EMAIL_FROM', '');
    const replyTo =
      this.configService.get<string>('EMAIL_REPLY_TO') || undefined;
    const rendered = renderEmailTemplate(params.template, {
      subject: params.subject,
      variables: params.variables,
    });

    if (provider === 'mock') {
      this.logger.log(
        JSON.stringify({
          provider,
          from,
          to: params.to,
          subject: rendered.subject,
          template: params.template,
          variables: this.redactSensitiveValues(params.variables),
        }),
      );

      return {
        delivered: true,
        provider,
        providerMessageId: `mock_${randomUUID()}`,
        providerAcknowledgedAt: new Date(),
        providerResponse: {
          mode: 'mock',
        } satisfies Prisma.JsonObject,
      };
    }

    if (!from) {
      throw new Error(
        'EMAIL_FROM is required when EMAIL_PROVIDER is not mock.',
      );
    }

    if (provider === 'resend') {
      return this.sendWithResend({
        from,
        to: params.to,
        replyTo,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    }

    if (provider === 'sendgrid') {
      return this.sendWithSendgrid({
        from,
        to: params.to,
        replyTo,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    }

    if (provider === 'postmark') {
      return this.sendWithPostmark({
        from,
        to: params.to,
        replyTo,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    }

    throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
  }

  private async sendWithResend(payload: {
    from: string;
    to: string;
    replyTo?: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<EmailDispatchResult> {
    const apiKey = this.configService.getOrThrow<string>('RESEND_API_KEY');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: payload.from,
        to: [payload.to],
        reply_to: payload.replyTo,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    const body = await this.ensureProviderSuccess('resend', response);
    return {
      delivered: true,
      provider: 'resend',
      providerMessageId: this.extractProviderMessageId(body),
      providerAcknowledgedAt: new Date(),
      providerResponse: body,
    };
  }

  private async sendWithSendgrid(payload: {
    from: string;
    to: string;
    replyTo?: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<EmailDispatchResult> {
    const apiKey = this.configService.getOrThrow<string>('SENDGRID_API_KEY');
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: payload.to }] }],
        from: { email: payload.from },
        reply_to: payload.replyTo ? { email: payload.replyTo } : undefined,
        subject: payload.subject,
        content: [
          { type: 'text/plain', value: payload.text },
          { type: 'text/html', value: payload.html },
        ],
      }),
    });

    const body = await this.ensureProviderSuccess('sendgrid', response);
    return {
      delivered: true,
      provider: 'sendgrid',
      providerMessageId:
        response.headers.get('x-message-id') ??
        this.extractProviderMessageId(body),
      providerAcknowledgedAt: new Date(),
      providerResponse:
        body ??
        ({
          status: response.status,
        } satisfies Prisma.JsonObject),
    };
  }

  private async sendWithPostmark(payload: {
    from: string;
    to: string;
    replyTo?: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<EmailDispatchResult> {
    const apiKey = this.configService.getOrThrow<string>(
      'POSTMARK_SERVER_TOKEN',
    );
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': apiKey,
      },
      body: JSON.stringify({
        From: payload.from,
        To: payload.to,
        ReplyTo: payload.replyTo,
        Subject: payload.subject,
        HtmlBody: payload.html,
        TextBody: payload.text,
      }),
    });

    const body = await this.ensureProviderSuccess('postmark', response);
    return {
      delivered: true,
      provider: 'postmark',
      providerMessageId: this.extractProviderMessageId(body),
      providerAcknowledgedAt: this.extractProviderAcknowledgedAt(body),
      providerResponse: body,
    };
  }

  private async ensureProviderSuccess(
    provider: string,
    response: Response,
  ): Promise<Prisma.JsonValue | null> {
    const body = await this.readProviderResponse(response);

    if (response.ok) {
      return body;
    }

    this.logger.error(
      `Email provider ${provider} failed: ${response.status} ${JSON.stringify(body)}`,
    );
    throw new Error(`Email provider ${provider} failed.`);
  }

  private async readProviderResponse(response: Response) {
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      return (await response.json().catch(() => null)) as Prisma.JsonValue | null;
    }

    const text = await response.text().catch(() => '');
    return text ? (text as Prisma.JsonValue) : null;
  }

  private extractProviderMessageId(body: Prisma.JsonValue | null) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return null;
    }

    const record = body as Record<string, unknown>;

    const messageIdCandidates = [
      record.id,
      record.messageId,
      record.MessageID,
      record.message_id,
    ];

    for (const candidate of messageIdCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }

    return null;
  }

  private extractProviderAcknowledgedAt(body: Prisma.JsonValue | null) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return new Date();
    }

    const record = body as Record<string, unknown>;
    const submittedAt =
      typeof record.SubmittedAt === 'string'
        ? record.SubmittedAt
        : typeof record.submittedAt === 'string'
          ? record.submittedAt
          : null;

    if (!submittedAt) {
      return new Date();
    }

    const acknowledgedAt = new Date(submittedAt);
    return Number.isNaN(acknowledgedAt.getTime())
      ? new Date()
      : acknowledgedAt;
  }

  private redactSensitiveValues(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.redactSensitiveValues(entry));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, entryValue]) => [
          key,
          this.isSensitiveKey(key)
            ? '[REDACTED]'
            : this.redactSensitiveValues(entryValue),
        ]),
      );
    }

    return value;
  }

  private isSensitiveKey(key: string) {
    const normalizedKey = key.toLowerCase();

    return [
      'otp',
      'token',
      'secret',
      'password',
      'authorization',
      'accesskey',
      'access_token',
      'refreshkey',
      'refresh_token',
    ].some((fragment) => normalizedKey.includes(fragment));
  }
}
