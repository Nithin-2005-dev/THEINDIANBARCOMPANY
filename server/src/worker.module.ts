import { Module } from '@nestjs/common';
import { AppModule } from './app.module';
import { QueueWorkersModule } from './queue/queue-workers.module';

@Module({
  imports: [AppModule, QueueWorkersModule],
})
export class WorkerModule {}
