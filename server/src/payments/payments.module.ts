import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { QueueModule } from '../queue/queue.module';
import { PaymentsController } from './payments.controller';
import { RazorpayGateway } from './gateway/razorpay.gateway';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuditModule, QueueModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayGateway],
  exports: [PaymentsService],
})
export class PaymentsModule {}
