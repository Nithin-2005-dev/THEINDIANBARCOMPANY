import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { StorageModule } from '../storage/storage.module';
import { ClientPortalBookingService } from './booking.service';
import { ClientPortalChatInboxService } from './chat-inbox.service';
import { ClientPortalChatService } from './chat.service';
import { ClientPortalChatStoreService } from './chat-store.service';
import { ClientPortalController } from './client-portal.controller';
import { ClientPortalService } from './client-portal.service';
import { ClientPortalNotificationService } from './notification.service';

@Module({
  imports: [PrismaModule, NotificationsModule, RealtimeModule, StorageModule],
  controllers: [ClientPortalController],
  providers: [
    ClientPortalService,
    ClientPortalBookingService,
    ClientPortalChatInboxService,
    ClientPortalChatService,
    ClientPortalChatStoreService,
    ClientPortalNotificationService,
  ],
  exports: [ClientPortalService],
})
export class ClientPortalModule {}
