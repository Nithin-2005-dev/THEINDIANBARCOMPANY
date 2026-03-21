import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminService } from './admin.service';
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

  @Get('pipeline')
  pipeline() {
    return this.adminService.pipeline();
  }

  @Get('system/overview')
  systemOverview() {
    return this.adminService.systemOverview();
  }

  @Post('system/sessions/revoke')
  revokeSession(@Body() dto: RevokeSessionDto) {
    return this.adminService.revokeSession(dto.sessionId, dto.reason);
  }
}
