import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { HealthCheck } from '@nestjs/terminus';
import { InternalMonitoringGuard } from '../common/guards/internal-monitoring.guard';
import { HealthService } from './health.service';

@ApiExcludeController()
@Controller({
  path: 'health',
  version: '1',
})
@UseGuards(InternalMonitoringGuard)
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HealthCheck()
  check() {
    return this.healthService.check();
  }
}
