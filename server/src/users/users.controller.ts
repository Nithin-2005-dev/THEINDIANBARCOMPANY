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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiBearerAuth('bearer')
  me(@CurrentUser() user: AuthUser) {
    return this.usersService
      .findByIdOrThrow(user.userId)
      .then((record) => this.usersService.serializeUser(record));
  }

  @Patch('me')
  @ApiBearerAuth('bearer')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Roles(Role.ADMIN)
  @Post('staff')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create a staff account' })
  @ApiBody({ type: CreateStaffUserDto })
  createStaff(@Body() dto: CreateStaffUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.createStaff(dto, user);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/role')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update a user role' })
  @ApiBody({ type: UpdateUserRoleDto })
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.updateRole(id, dto, user);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/status')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Activate or deactivate a user account' })
  @ApiBody({ type: UpdateUserStatusDto })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.updateStatus(id, dto, user);
  }

  @Roles(Role.ADMIN)
  @Get()
  @ApiBearerAuth('bearer')
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.usersService.listUsers(query);
  }
}
