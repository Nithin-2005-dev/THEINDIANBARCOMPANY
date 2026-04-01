import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AssignmentRole, LeadStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { AssignLeadStaffDto } from './dto/assign-lead-staff.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { CreateOfflineLeadDto } from './dto/create-offline-lead.dto';
import { CreateLeadManualActivityDto } from './dto/create-lead-manual-activity.dto';
import { CreateLeadNoteDto } from './dto/create-lead-note.dto';
import {
  LeadSortBy,
  ListLeadsQueryDto,
  SortOrder,
} from './dto/list-leads-query.dto';
import { UpdateLeadNoteDto } from './dto/update-lead-note.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { LeadsService } from './leads.service';

const STAFF_ROLES: Role[] = [Role.ADMIN, Role.SALES, Role.OPS, Role.FINANCE];

@ApiTags('Leads')
@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Roles(Role.CLIENT, ...STAFF_ROLES)
  @Post()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create a new lead / requirement' })
  @ApiBody({ type: CreateLeadDto })
  @ApiHeader({
    name: 'idempotency-key',
    required: false,
    description: 'Optional idempotency key for safe retries',
  })
  @ApiOkResponse({ description: 'Lead created successfully' })
  create(
    @Body() dto: CreateLeadDto,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.leadsService.create(dto, user.userId, idempotencyKey);
  }

  @Roles(...STAFF_ROLES)
  @Post('offline')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create a booking on behalf of an offline client' })
  @ApiBody({ type: CreateOfflineLeadDto })
  @ApiHeader({
    name: 'idempotency-key',
    required: false,
    description: 'Optional idempotency key for safe retries',
  })
  @ApiOkResponse({ description: 'Offline booking created successfully' })
  createOffline(
    @Body() dto: CreateOfflineLeadDto,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.leadsService.createOfflineBooking(dto, user, idempotencyKey);
  }

  @Roles(Role.CLIENT)
  @Get('mine')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List leads belonging to the authenticated client' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: LeadStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'location', required: false, type: String })
  @ApiQuery({ name: 'budgetMin', required: false, type: Number })
  @ApiQuery({ name: 'budgetMax', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, enum: LeadSortBy })
  @ApiQuery({ name: 'sortOrder', required: false, enum: SortOrder })
  @ApiOkResponse({
    description: 'Paginated client leads returned successfully',
  })
  findMine(@CurrentUser() user: AuthUser, @Query() query: ListLeadsQueryDto) {
    return this.leadsService.findMine(user.userId, query);
  }

  @Roles(...STAFF_ROLES)
  @Get()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List all leads for staff users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: LeadStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'location', required: false, type: String })
  @ApiQuery({ name: 'budgetMin', required: false, type: Number })
  @ApiQuery({ name: 'budgetMax', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, enum: LeadSortBy })
  @ApiQuery({ name: 'sortOrder', required: false, enum: SortOrder })
  @ApiOkResponse({ description: 'Paginated lead list returned successfully' })
  findAll(@Query() query: ListLeadsQueryDto, @CurrentUser() user: AuthUser) {
    return this.leadsService.findAll(query, user);
  }

  @Roles(Role.CLIENT, ...STAFF_ROLES)
  @Get(':id')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get a single lead by id' })
  @ApiParam({ name: 'id', description: 'Lead identifier' })
  @ApiOkResponse({ description: 'Lead returned successfully' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.findOneForUser(id, user);
  }

  @Roles(...STAFF_ROLES)
  @Patch(':id/status')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update the status of a lead' })
  @ApiParam({ name: 'id', description: 'Lead identifier' })
  @ApiBody({ type: UpdateLeadStatusDto })
  @ApiOkResponse({ description: 'Lead status updated successfully' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.updateStatus(id, dto, user);
  }

  @Roles(...STAFF_ROLES)
  @Get(':id/notes')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List internal notes for a lead' })
  listNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.listNotes(id, user);
  }

  @Roles(...STAFF_ROLES)
  @Post(':id/notes')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create an internal note for a lead' })
  createNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLeadNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.createNote(id, dto, user);
  }

  @Roles(...STAFF_ROLES)
  @Patch(':id/notes/:noteId')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Edit an internal note for a lead' })
  @ApiParam({ name: 'noteId', description: 'Lead note identifier' })
  updateNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateLeadNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.updateNote(id, noteId, dto, user);
  }

  @Roles(...STAFF_ROLES)
  @Delete(':id/notes/:noteId')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Soft delete an internal note for a lead' })
  @ApiParam({ name: 'noteId', description: 'Lead note identifier' })
  deleteNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.deleteNote(id, noteId, user);
  }

  @Roles(...STAFF_ROLES)
  @Get(':id/timeline')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List the lead activity timeline' })
  listTimeline(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.listTimeline(id, user);
  }

  @Roles(...STAFF_ROLES)
  @Post(':id/timeline/manual')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Create a manual lead timeline event' })
  addManualTimelineEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLeadManualActivityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.addManualActivity(id, dto, user);
  }

  @Roles(...STAFF_ROLES)
  @Get(':id/status-history')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List persisted status history for a lead' })
  listStatusHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.listStatusHistory(id, user);
  }

  @Roles(...STAFF_ROLES)
  @Get(':id/assignments')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List lead staff assignments' })
  listAssignments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.listAssignments(id, user);
  }

  @Roles(...STAFF_ROLES)
  @Post(':id/assignments')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Assign staff to a lead' })
  @ApiBody({ type: AssignLeadStaffDto })
  @ApiQuery({ name: 'role', required: false, enum: AssignmentRole })
  assignStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignLeadStaffDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.assignStaff(id, dto, user);
  }
}
