import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { ProjectExecutionController } from './project-execution.controller';
import { ProjectExecutionService } from './project-execution.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AuditModule, NotificationsModule, QueueModule, StorageModule],
  controllers: [ProjectsController, ProjectExecutionController],
  providers: [ProjectsService, ProjectExecutionService],
  exports: [ProjectsService, ProjectExecutionService],
})
export class ProjectsModule {}
