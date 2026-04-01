import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { StaffService } from './staff.service';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SALES, Role.OPS, Role.FINANCE)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.staffService.getDashboard(user);
  }

  @Get('inbox')
  inbox(@CurrentUser() user: AuthUser) {
    return this.staffService.listInbox(user);
  }

  @Get('notifications')
  notifications(@CurrentUser() user: AuthUser) {
    return this.staffService.listNotifications(user.userId);
  }

  @Patch('notifications/:id/read')
  markNotificationRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.staffService.markNotificationRead(user.userId, id);
  }
}
