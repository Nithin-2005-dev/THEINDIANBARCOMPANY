import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueService } from './queue.service';
import {
  NotificationsProcessor,
  OtpProcessor,
  PaymentsProcessor,
  RemindersProcessor,
  VendorsProcessor,
} from './queue.processors';

@Global()
@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue(
      { name: 'otp' },
      { name: 'notifications' },
      { name: 'payments' },
      { name: 'vendors' },
      { name: 'reminders' },
    ),
  ],
  providers: [
    QueueService,
    OtpProcessor,
    NotificationsProcessor,
    PaymentsProcessor,
    VendorsProcessor,
    RemindersProcessor,
  ],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
