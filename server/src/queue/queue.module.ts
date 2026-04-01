import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'otp' },
      { name: 'notifications' },
      { name: 'payments' },
      { name: 'vendors' },
      { name: 'reminders' },
    ),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
