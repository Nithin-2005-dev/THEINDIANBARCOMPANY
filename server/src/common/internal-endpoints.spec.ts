import { INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { HealthController } from '../health/health.controller';
import { HealthService } from '../health/health.service';
import { MetricsController } from '../metrics/metrics.controller';
import { MetricsService } from '../metrics/metrics.service';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { InternalMonitoringGuard } from './guards/internal-monitoring.guard';

describe('Internal endpoint protection', () => {
  let app: INestApplication;
  let metricsToken: string | undefined;

  const metricsService = {
    getMetrics: jest.fn(() => 'test_metric 1\n'),
  };

  const healthService = {
    check: jest.fn(() => ({
      status: 'ok',
      info: {
        database: {
          status: 'up',
        },
      },
    })),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController, HealthController],
      providers: [
        InternalMonitoringGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'METRICS_TOKEN') {
                return metricsToken;
              }

              return undefined;
            }),
          },
        },
        {
          provide: MetricsService,
          useValue: metricsService,
        },
        {
          provide: HealthService,
          useValue: healthService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  beforeEach(() => {
    metricsToken = undefined;
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 404 for metrics when no token is configured', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/metrics')
      .expect(404);

    expect(response.body.error.statusCode).toBe(404);
    expect(metricsService.getMetrics).not.toHaveBeenCalled();
  });

  it('returns 404 for metrics when the token is left at the placeholder value', async () => {
    metricsToken = 'change-me-before-use';

    const response = await request(app.getHttpServer())
      .get('/api/v1/metrics')
      .set('Authorization', 'Bearer change-me-before-use')
      .expect(404);

    expect(response.body.error.statusCode).toBe(404);
    expect(metricsService.getMetrics).not.toHaveBeenCalled();
  });

  it('returns 401 for metrics when the bearer token is wrong', async () => {
    metricsToken = 'expected-monitoring-token';

    const response = await request(app.getHttpServer())
      .get('/api/v1/metrics')
      .set('Authorization', 'Bearer wrong-token')
      .expect(401);

    expect(response.body.error.statusCode).toBe(401);
    expect(response.body.error.message).toBe(
      'Internal access token is invalid.',
    );
    expect(metricsService.getMetrics).not.toHaveBeenCalled();
  });

  it('returns metrics when the bearer token is correct', async () => {
    metricsToken = 'expected-monitoring-token';

    const response = await request(app.getHttpServer())
      .get('/api/v1/metrics')
      .set('Authorization', `Bearer ${metricsToken}`)
      .expect(200);

    expect(response.text).toBe('test_metric 1\n');
    expect(response.headers['content-type']).toContain('text/plain');
    expect(metricsService.getMetrics).toHaveBeenCalledTimes(1);
  });

  it('returns 404 for health when no token is configured', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(404);

    expect(response.body.error.statusCode).toBe(404);
    expect(healthService.check).not.toHaveBeenCalled();
  });

  it('returns health data when the bearer token is correct', async () => {
    metricsToken = 'expected-monitoring-token';

    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Authorization', `Bearer ${metricsToken}`)
      .expect(200);

    expect(response.body).toEqual({
      info: {
        database: {
          status: 'up',
        },
      },
      status: 'ok',
    });
    expect(healthService.check).toHaveBeenCalledTimes(1);
  });
});
