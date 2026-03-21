import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { ContractsModule } from './contracts/contracts.module';
import { HealthModule } from './health/health.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { LeadsModule } from './leads/leads.module';
import { MetricsModule } from './metrics/metrics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { ProposalsModule } from './proposals/proposals.module';
import { QueueModule } from './queue/queue.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';
import { VendorsModule } from './vendors/vendors.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').default('development'),
        PORT: Joi.number().port().required(),
        API_CORS_ORIGINS: Joi.string().required(),
        API_BODY_LIMIT: Joi.string().default('1mb'),
        DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_EXPIRES_IN: Joi.string().required(),
        OTP_EXPIRY_MINUTES: Joi.number().min(1).max(30).required(),
        OTP_RESEND_COOLDOWN_SECONDS: Joi.number().min(10).max(300).required(),
        OTP_MAX_REQUESTS_PER_WINDOW: Joi.number().min(1).max(20).required(),
        OTP_REQUEST_WINDOW_MINUTES: Joi.number().min(1).max(60).required(),
        OTP_MAX_FAILURES: Joi.number().min(1).max(20).required(),
        OTP_LOCK_MINUTES: Joi.number().min(1).max(120).required(),
        THROTTLE_TTL_SECONDS: Joi.number().min(1).required(),
        THROTTLE_LIMIT: Joi.number().min(1).required(),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().port().required(),
        REDIS_PASSWORD: Joi.string().allow('').optional(),
        SMS_PROVIDER: Joi.string().valid('mock', 'twilio', 'msg91', 'sns').required(),
        SMS_FROM: Joi.string().allow('').optional(),
        TWILIO_ACCOUNT_SID: Joi.string().allow('').optional(),
        TWILIO_AUTH_TOKEN: Joi.string().allow('').optional(),
        S3_BUCKET: Joi.string().required(),
        S3_REGION: Joi.string().required(),
        S3_ENDPOINT: Joi.string().uri().required(),
        S3_ACCESS_KEY: Joi.string().required(),
        S3_SECRET_KEY: Joi.string().required(),
        S3_PRESIGNED_URL_TTL_SECONDS: Joi.number().min(60).required(),
        STORAGE_MAX_FILE_SIZE_BYTES: Joi.number().min(1024).required(),
        RAZORPAY_KEY_ID: Joi.string().required(),
        RAZORPAY_KEY_SECRET: Joi.string().required(),
        RAZORPAY_WEBHOOK_SECRET: Joi.string().required(),
        EMAIL_PROVIDER: Joi.string().valid('mock', 'ses', 'sendgrid', 'postmark').default('mock'),
        METRICS_TOKEN: Joi.string().allow('').optional(),
        SWAGGER_ENABLED: Joi.string().valid('true', 'false').default('false'),
        SENTRY_DSN: Joi.string().allow('').optional(),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: configService.getOrThrow<number>('REDIS_PORT'),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 1000,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.getOrThrow<number>('THROTTLE_TTL_SECONDS') * 1000,
          limit: configService.getOrThrow<number>('THROTTLE_LIMIT'),
        },
      ],
    }),
    PrismaModule,
    MetricsModule,
    AuditModule,
    IdempotencyModule,
    QueueModule,
    NotificationsModule,
    EmailModule,
    StorageModule,
    HealthModule,
    AuthModule,
    UsersModule,
    LeadsModule,
    ProposalsModule,
    ContractsModule,
    ProjectsModule,
    VendorsModule,
    PaymentsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
