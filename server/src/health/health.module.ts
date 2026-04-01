import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { InternalMonitoringGuard } from '../common/guards/internal-monitoring.guard';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [HealthService, InternalMonitoringGuard],
})
export class HealthModule {}
