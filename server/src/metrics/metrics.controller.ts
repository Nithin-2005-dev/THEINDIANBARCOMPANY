import { Controller, Get, Header, Headers, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service';

@Controller({
  path: 'metrics',
  version: '1',
})
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  metrics(@Headers('x-metrics-token') token?: string) {
    const expectedToken = this.configService.get<string>('METRICS_TOKEN');
    if (expectedToken && token !== expectedToken) {
      throw new UnauthorizedException('Metrics token is invalid.');
    }

    return this.metricsService.getMetrics();
  }
}
