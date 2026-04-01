import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { AdminService } from './admin.service';
import { AssistantAnalyticsQueryDto } from './dto/assistant-analytics-query.dto';
import { RevokeSessionDto } from './dto/revoke-session.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('analytics')
  analytics() {
    return this.adminService.analytics();
  }

  @Get('assistant/analytics')
  assistantAnalytics(@Query() query: AssistantAnalyticsQueryDto) {
    return this.adminService.assistantAnalytics(query);
  }

  @Get('pipeline')
  pipeline() {
    return this.adminService.pipeline();
  }

  @Get('system/overview')
  systemOverview() {
    return this.adminService.systemOverview();
  }

  @Get('notifications')
  notifications(@CurrentUser() user: AuthUser) {
    return this.adminService.listNotifications(user.userId);
  }

  @Patch('notifications/:id/read')
  markNotificationRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.markNotificationRead(user.userId, id);
  }

  @Post('system/sessions/revoke')
  revokeSession(@Body() dto: RevokeSessionDto) {
    return this.adminService.revokeSession(dto.sessionId, dto.reason);
  }
}
