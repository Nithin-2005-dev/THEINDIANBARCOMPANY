import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LeadsModule } from '../leads/leads.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../queue/queue.module';
import { PaymentsController } from './payments.controller';
import { RazorpayGateway } from './gateway/razorpay.gateway';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuditModule, QueueModule, LeadsModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayGateway],
  exports: [PaymentsService],
})
export class PaymentsModule {}
