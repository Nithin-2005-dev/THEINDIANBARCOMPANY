import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { IdempotencyStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(params: {
    key?: string;
    scope: string;
    userId?: string;
    request: unknown;
    ttlMinutes?: number;
    execute: () => Promise<T>;
  }) {
    if (!params.key) {
      return params.execute();
    }

    const requestHash = createHash('sha256')
      .update(JSON.stringify(params.request))
      .digest('hex');
    const expiresAt = new Date(Date.now() + (params.ttlMinutes ?? 60) * 60 * 1000);

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: {
        key_scope: {
          key: params.key,
          scope: params.scope,
        },
      },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new BadRequestException(
          'Idempotency key cannot be reused with a different request body.',
        );
      }

      if (existing.status === IdempotencyStatus.COMPLETED) {
        return existing.responseBody as T;
      }

      if (existing.status === IdempotencyStatus.PROCESSING) {
        throw new ConflictException('A request with this idempotency key is already in progress.');
      }
    }

    await this.prisma.idempotencyKey.upsert({
      where: {
        key_scope: {
          key: params.key,
          scope: params.scope,
        },
      },
      update: {
        requestHash,
        status: IdempotencyStatus.PROCESSING,
        userId: params.userId,
        expiresAt,
      },
      create: {
        key: params.key,
        scope: params.scope,
        requestHash,
        status: IdempotencyStatus.PROCESSING,
        userId: params.userId,
        expiresAt,
      },
    });

    try {
      const result = await params.execute();

      await this.prisma.idempotencyKey.update({
        where: {
          key_scope: {
            key: params.key,
            scope: params.scope,
          },
        },
        data: {
          status: IdempotencyStatus.COMPLETED,
          responseCode: 200,
          responseBody: result as Prisma.InputJsonValue,
        },
      });

      return result;
    } catch (error) {
      await this.prisma.idempotencyKey.update({
        where: {
          key_scope: {
            key: params.key,
            scope: params.scope,
          },
        },
        data: {
          status: IdempotencyStatus.FAILED,
        },
      });

      throw error;
    }
  }
}
