import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalMonitoringGuard } from '../common/guards/internal-monitoring.guard';
import { MetricsService } from './metrics.service';

@ApiExcludeController()
@Controller({
  path: 'metrics',
  version: '1',
})
@UseGuards(InternalMonitoringGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  metrics() {
    return this.metricsService.getMetrics();
  }
}
