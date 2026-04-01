import { Global, Module } from '@nestjs/common';
import { InternalMonitoringGuard } from '../common/guards/internal-monitoring.guard';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, InternalMonitoringGuard],
  exports: [MetricsService],
})
export class MetricsModule {}
