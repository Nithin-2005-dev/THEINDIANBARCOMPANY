import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  NotificationsProcessor,
  OtpProcessor,
  PaymentsProcessor,
  RemindersProcessor,
  VendorsProcessor,
} from './queue.processors';

@Module({
  imports: [NotificationsModule, PrismaModule],
  providers: [
    OtpProcessor,
    NotificationsProcessor,
    PaymentsProcessor,
    VendorsProcessor,
    RemindersProcessor,
  ],
})
export class QueueWorkersModule {}
