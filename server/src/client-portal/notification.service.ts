import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ClientPortalNotificationService {
  constructor(private readonly notificationsService: NotificationsService) {}

  async listNotifications(userId: string) {
    return this.notificationsService.listForUser(userId, 50);
  }

  async markNotificationRead(userId: string, notificationId: string) {
    await this.notificationsService.markRead(userId, notificationId);
    return { success: true };
  }
}
