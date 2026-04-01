import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { CreateMessageDto } from './dto/create-message.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { ClientPortalService } from './client-portal.service';
import { CreateUploadUrlDto } from '../storage/dto/create-upload-url.dto';
import { UpdateTypingStatusDto } from './dto/update-typing-status.dto';

@Controller('client-portal')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientPortalController {
  constructor(private readonly clientPortalService: ClientPortalService) {}

  @Roles(Role.CLIENT)
  @Get('dashboard')
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.clientPortalService.getDashboard(user.userId);
  }

  @Roles(Role.CLIENT)
  @Get('events/:id')
  getEventDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientPortalService.getEventDetails(id, user.userId);
  }

  @Roles(Role.CLIENT)
  @Get('notifications')
  listNotifications(@CurrentUser() user: AuthUser) {
    return this.clientPortalService.listNotifications(user.userId);
  }

  @Roles(
    Role.CLIENT,
    Role.ADMIN,
    Role.SALES,
    Role.OPS,
    Role.FINANCE,
    Role.VENDOR,
  )
  @Get('inbox')
  listInbox(@CurrentUser() user: AuthUser) {
    return this.clientPortalService.listInbox(user);
  }

  @Roles(
    Role.CLIENT,
    Role.ADMIN,
    Role.SALES,
    Role.OPS,
    Role.FINANCE,
    Role.VENDOR,
  )
  @Get('events/:id/thread')
  getThread(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Query('conversationType') conversationType?: string,
  ) {
    return this.clientPortalService.getThread(id, user, conversationType);
  }

  @Roles(
    Role.CLIENT,
    Role.ADMIN,
    Role.SALES,
    Role.OPS,
    Role.FINANCE,
    Role.VENDOR,
  )
  @Get('events/:id/thread-window')
  getThreadWindow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Query('conversationType') conversationType?: string,
    @Query('limit') limit?: string,
    @Query('beforeCreatedAt') beforeCreatedAt?: string,
    @Query('beforeId') beforeId?: string,
    @Query('search') search?: string,
    @Query('date') date?: string,
    @Query('hasAttachment') hasAttachment?: string,
  ) {
    return this.clientPortalService.getThreadWindow(id, user, {
      conversationType,
      limit: limit ? Number(limit) : undefined,
      beforeCreatedAt,
      beforeId,
      search,
      date,
      hasAttachment: hasAttachment === 'true',
    });
  }

  @Roles(Role.CLIENT)
  @Patch('notifications/:id/read')
  markNotificationRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientPortalService.markNotificationRead(user.userId, id);
  }

  @Roles(
    Role.CLIENT,
    Role.ADMIN,
    Role.SALES,
    Role.OPS,
    Role.FINANCE,
    Role.VENDOR,
  )
  @Post('events/:id/messages')
  sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: AuthUser,
    @Query('conversationType') conversationType?: string,
  ) {
    return this.clientPortalService.sendMessage(
      id,
      dto,
      user,
      conversationType,
    );
  }

  @Roles(
    Role.CLIENT,
    Role.ADMIN,
    Role.SALES,
    Role.OPS,
    Role.FINANCE,
    Role.VENDOR,
  )
  @Post('events/:id/message-upload-url')
  createMessageUploadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateUploadUrlDto,
    @CurrentUser() user: AuthUser,
    @Query('conversationType') conversationType?: string,
  ) {
    return this.clientPortalService.createMessageAttachmentUploadUrl(
      id,
      dto,
      user,
      conversationType,
    );
  }

  @Roles(
    Role.CLIENT,
    Role.ADMIN,
    Role.SALES,
    Role.OPS,
    Role.FINANCE,
    Role.VENDOR,
  )
  @Post('events/:id/typing')
  updateTypingStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTypingStatusDto,
    @CurrentUser() user: AuthUser,
    @Query('conversationType') conversationType?: string,
  ) {
    return this.clientPortalService.updateTypingStatus(
      id,
      dto,
      user,
      conversationType,
    );
  }

  @Roles(Role.CLIENT)
  @Post('projects/:id/feedback')
  submitFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitFeedbackDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientPortalService.submitFeedback(id, dto, user.userId);
  }
}
