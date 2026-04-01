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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { AssignProjectStaffDto } from './dto/assign-project-staff.dto';
import { CreateProjectUpdateDto } from './dto/create-project-update.dto';
import {
  ListProjectsQueryDto,
  ProjectSortBy,
  SortOrder,
} from './dto/list-projects-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

const STAFF_ROLES: Role[] = [Role.ADMIN, Role.SALES, Role.OPS, Role.FINANCE];

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Roles(Role.CLIENT, ...STAFF_ROLES)
  @Get()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List projects for the authenticated user' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'location', required: false, type: String })
  @ApiQuery({ name: 'budgetMin', required: false, type: Number })
  @ApiQuery({ name: 'budgetMax', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, enum: ProjectSortBy })
  @ApiQuery({ name: 'sortOrder', required: false, enum: SortOrder })
  list(@CurrentUser() user: AuthUser, @Query() query: ListProjectsQueryDto) {
    return this.projectsService.listForUser(user, query);
  }

  @Roles(Role.CLIENT)
  @Get('dashboard')
  @ApiBearerAuth('bearer')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.projectsService.getDashboard(user.userId);
  }

  @Roles(Role.CLIENT, ...STAFF_ROLES)
  @Get(':id')
  @ApiBearerAuth('bearer')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectsService.findOneForUser(id, user);
  }

  @Roles(Role.CLIENT, ...STAFF_ROLES)
  @Get(':id/updates')
  @ApiBearerAuth('bearer')
  listUpdates(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectsService.listUpdates(id, user);
  }

  @Roles(Role.ADMIN, Role.OPS)
  @Patch(':id')
  @ApiBearerAuth('bearer')
  @ApiBody({ type: UpdateProjectDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectsService.update(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.OPS)
  @Post(':id/vendors/:vendorId')
  @ApiBearerAuth('bearer')
  @ApiParam({ name: 'vendorId', description: 'Vendor identifier' })
  assignVendor(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectsService.assignVendor(id, vendorId, user);
  }

  @Roles(Role.ADMIN, Role.OPS)
  @Post(':id/updates')
  @ApiBearerAuth('bearer')
  @ApiBody({ type: CreateProjectUpdateDto })
  createUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProjectUpdateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectsService.createUpdate(id, dto, user);
  }

  @Roles(...STAFF_ROLES)
  @Get(':id/assignments')
  @ApiBearerAuth('bearer')
  listAssignments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectsService.listAssignments(id, user);
  }

  @Roles(Role.ADMIN, Role.OPS)
  @Post(':id/assignments')
  @ApiBearerAuth('bearer')
  @ApiBody({ type: AssignProjectStaffDto })
  assignStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignProjectStaffDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projectsService.assignStaff(id, dto, user);
  }
}
