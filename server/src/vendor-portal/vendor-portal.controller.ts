import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { CreateVendorStatusUpdateDto } from './dto/create-vendor-status-update.dto';
import { VendorPortalService } from './vendor-portal.service';

@Controller('vendor-portal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VENDOR)
export class VendorPortalController {
  constructor(private readonly vendorPortalService: VendorPortalService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.vendorPortalService.getDashboard(user);
  }

  @Get('projects/:id')
  project(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vendorPortalService.getProject(id, user);
  }

  @Post('projects/:id/status')
  createStatusUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVendorStatusUpdateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vendorPortalService.createStatusUpdate(id, dto, user);
  }

  @Get('notifications')
  notifications(@CurrentUser() user: AuthUser) {
    return this.vendorPortalService.listNotifications(user.userId);
  }

  @Patch('notifications/:id/read')
  markNotificationRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vendorPortalService.markNotificationRead(user.userId, id);
  }
}
