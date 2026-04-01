import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { initSentry } from './common/monitoring/sentry';
import { SanitizationPipe } from './common/pipes/sanitization.pipe';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: false,
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const prismaService = app.get(PrismaService);
  initSentry(configService.get<string>('SENTRY_DSN'));

  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  prismaService.enableShutdownHooks(app);

  app.use(helmet());

  const bodyLimit = configService.get<string>('API_BODY_LIMIT') ?? '1mb';

  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  app.enableCors({
    origin:
      configService
        .get<string>('API_CORS_ORIGINS')
        ?.split(',')
        .map((origin) => origin.trim()) ?? '*',
    credentials: true,
  });

  app.useGlobalPipes(
    new SanitizationPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Party as a Service API')
    .setDescription(
      'Production-ready backend for the Party-as-a-Service platform',
    )
    .setVersion('1.0.0')
    .setContact('API Team', 'https://example.com', 'api@example.com')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste a valid JWT access token here',
      },
      'bearer',
    )
    .build();

  const swaggerEnabled =
    process.env.NODE_ENV !== 'production' ||
    process.env.SWAGGER_ENABLED === 'true';

  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
      customSiteTitle: 'Party as a Service API Docs',
    });
  }

  const port = Number(process.env.PORT) || 3000;

  // Avoid forcing IPv4-only binding so localhost works on both IPv4 and IPv6 stacks.
  await app.listen(port);

  console.log(`Server running on port ${port}`);
}

void bootstrap();
