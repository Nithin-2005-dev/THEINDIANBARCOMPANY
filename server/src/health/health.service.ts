import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly redis: Redis;

  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.configService.getOrThrow<string>('REDIS_HOST'),
      port: this.configService.getOrThrow<number>('REDIS_PORT'),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  check() {
    return this.health.check([
      async () => this.prismaIndicator.pingCheck('database', this.prisma),
      async () => {
        const pong = await this.redis.ping();
        if (pong !== 'PONG') {
          throw new Error('Redis ping failed');
        }
        return {
          redis: {
            status: 'up',
          },
        };
      },
    ]);
  }
}
