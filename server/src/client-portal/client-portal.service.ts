import { Injectable } from '@nestjs/common';
import { CreateUploadUrlDto } from '../storage/dto/create-upload-url.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { UpdateTypingStatusDto } from './dto/update-typing-status.dto';
import { ClientPortalBookingService } from './booking.service';
import { ClientPortalChatService } from './chat.service';
import { ClientPortalNotificationService } from './notification.service';
import { type PortalUser, type ThreadWindowQuery } from './client-portal.types';

@Injectable()
export class ClientPortalService {
  constructor(
    private readonly bookingService: ClientPortalBookingService,
    private readonly chatService: ClientPortalChatService,
    private readonly notificationService: ClientPortalNotificationService,
  ) {}

  async getDashboard(userId: string) {
    return this.bookingService.getDashboard(userId);
  }

  async getEventDetails(leadId: string, userId: string) {
    return this.bookingService.getEventDetails(leadId, userId);
  }

  async listNotifications(userId: string) {
    return this.notificationService.listNotifications(userId);
  }

  async markNotificationRead(userId: string, notificationId: string) {
    return this.notificationService.markNotificationRead(
      userId,
      notificationId,
    );
  }

  async sendMessage(
    leadId: string,
    dto: CreateMessageDto,
    actor: PortalUser,
    conversationType?: string,
  ) {
    return this.chatService.sendMessage(leadId, dto, actor, conversationType);
  }

  async getThread(
    leadId: string,
    actor: PortalUser,
    conversationType?: string,
  ) {
    return this.chatService.getThread(leadId, actor, conversationType);
  }

  async getThreadWindow(
    leadId: string,
    actor: PortalUser,
    query: ThreadWindowQuery,
  ) {
    return this.chatService.getThreadWindow(leadId, actor, query);
  }

  async updateTypingStatus(
    leadId: string,
    dto: UpdateTypingStatusDto,
    actor: PortalUser,
    conversationType?: string,
  ) {
    return this.chatService.updateTypingStatus(
      leadId,
      dto,
      actor,
      conversationType,
    );
  }

  async listInbox(actor: PortalUser) {
    return this.chatService.listInbox(actor);
  }

  async createMessageAttachmentUploadUrl(
    leadId: string,
    dto: CreateUploadUrlDto,
    actor: PortalUser,
    conversationType?: string,
  ) {
    return this.chatService.createMessageAttachmentUploadUrl(
      leadId,
      dto,
      actor,
      conversationType,
    );
  }

  async submitFeedback(
    projectId: string,
    dto: SubmitFeedbackDto,
    userId: string,
  ) {
    return this.bookingService.submitFeedback(projectId, dto, userId);
  }
}
