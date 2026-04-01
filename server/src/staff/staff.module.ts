import { Module } from '@nestjs/common';
import { ClientPortalModule } from '../client-portal/client-portal.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [PrismaModule, NotificationsModule, ClientPortalModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
