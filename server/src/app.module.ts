import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { AssistantModule } from './assistant/assistant.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BootstrapModule } from './bootstrap/bootstrap.module';
import { EmailModule } from './email/email.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { ContractsModule } from './contracts/contracts.module';
import { ClientPortalModule } from './client-portal/client-portal.module';
import { HealthModule } from './health/health.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { LeadsModule } from './leads/leads.module';
import { MetricsModule } from './metrics/metrics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { ProposalsModule } from './proposals/proposals.module';
import { PublicBookingsModule } from './public-bookings/public-bookings.module';
import { QueueModule } from './queue/queue.module';
import { QueueWorkersModule } from './queue/queue-workers.module';
import { RealtimeModule } from './realtime/realtime.module';
import { StorageModule } from './storage/storage.module';
import { TeamModule } from './team/team.module';
import { UsersModule } from './users/users.module';
import { StaffModule } from './staff/staff.module';
import { VendorPortalModule } from './vendor-portal/vendor-portal.module';
import { VendorsModule } from './vendors/vendors.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [join(process.cwd(), '.env'), join(process.cwd(), 'server', '.env')],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'staging', 'production')
          .default('development'),
        PORT: Joi.number().port().required(),
        API_CORS_ORIGINS: Joi.string().required(),
        API_BODY_LIMIT: Joi.string().default('1mb'),
        DATABASE_URL: Joi.string()
          .uri({ scheme: ['postgresql', 'postgres'] })
          .required(),
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
        SMS_PROVIDER: Joi.string()
          .valid('mock', 'twilio', 'msg91', 'sns')
          .required(),
        SMS_FROM: Joi.string().allow('').optional(),
        TWILIO_ACCOUNT_SID: Joi.string().allow('').optional(),
        TWILIO_AUTH_TOKEN: Joi.string().allow('').optional(),
        S3_BUCKET: Joi.string().required(),
        S3_REGION: Joi.string().required(),
        S3_ENDPOINT: Joi.string().uri().required(),
        S3_PUBLIC_BASE_URL: Joi.string().uri().allow('').optional(),
        S3_ACCESS_KEY: Joi.string().required(),
        S3_SECRET_KEY: Joi.string().required(),
        S3_PRESIGNED_URL_TTL_SECONDS: Joi.number().min(60).required(),
        STORAGE_MAX_FILE_SIZE_BYTES: Joi.number().min(1024).required(),
        CLOUDINARY_CLOUD_NAME: Joi.string().allow('').optional(),
        CLOUDINARY_API_KEY: Joi.string().allow('').optional(),
        CLOUDINARY_API_SECRET: Joi.string().allow('').optional(),
        TEAM_IMAGE_MAX_FILE_SIZE_BYTES: Joi.number().min(1024).optional(),
        RAZORPAY_KEY_ID: Joi.string().required(),
        RAZORPAY_KEY_SECRET: Joi.string().required(),
        RAZORPAY_WEBHOOK_SECRET: Joi.string().required(),
        EMAIL_PROVIDER: Joi.string()
          .valid('mock', 'resend', 'sendgrid', 'postmark')
          .default('mock'),
        EMAIL_FROM: Joi.string().email({ tlds: false }).allow('').optional(),
        EMAIL_REPLY_TO: Joi.string()
          .email({ tlds: false })
          .allow('')
          .optional(),
        RESEND_API_KEY: Joi.string().allow('').optional(),
        SENDGRID_API_KEY: Joi.string().allow('').optional(),
        POSTMARK_SERVER_TOKEN: Joi.string().allow('').optional(),
        METRICS_TOKEN: Joi.string().allow('').optional(),
        SWAGGER_ENABLED: Joi.string().valid('true', 'false').default('false'),
        SENTRY_DSN: Joi.string().allow('').optional(),
        OPENAI_API_KEY: Joi.string().allow('').optional(),
        OPENAI_MODEL: Joi.string().allow('').optional(),
        OPENAI_BASE_URL: Joi.string().uri().allow('').optional(),
        OPENAI_RESPONSE_TIMEOUT_MS: Joi.number().min(1000).empty('').optional(),
        OPENAI_MAX_OUTPUT_TOKENS: Joi.number().min(64).empty('').optional(),
        ADMIN_BOOTSTRAP_TOKEN: Joi.string().allow('').optional(),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: configService.getOrThrow<number>('REDIS_PORT'),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          enableOfflineQueue: false,
          maxRetriesPerRequest: null,
          retryStrategy: (attempt: number) => Math.min(attempt * 1000, 5000),
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
    AssistantModule,
    IdempotencyModule,
    QueueModule,
    QueueWorkersModule,
    RealtimeModule,
    NotificationsModule,
    EmailModule,
    StorageModule,
    HealthModule,
    BootstrapModule,
    ClientPortalModule,
    AuthModule,
    UsersModule,
    LeadsModule,
    ProposalsModule,
    ContractsModule,
    ProjectsModule,
    PublicBookingsModule,
    TeamModule,
    VendorsModule,
    VendorPortalModule,
    PaymentsModule,
    StaffModule,
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
