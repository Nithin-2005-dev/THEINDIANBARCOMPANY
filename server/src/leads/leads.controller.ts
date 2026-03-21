import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
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
import { LeadStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { LeadsService } from './leads.service';

@ApiTags('Leads')
@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Roles(Role.CLIENT, Role.ADMIN)
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

  @Roles(Role.CLIENT)
  @Get('mine')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List leads belonging to the authenticated client' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: LeadStatus })
  @ApiOkResponse({ description: 'Paginated client leads returned successfully' })
  findMine(@CurrentUser() user: AuthUser, @Query() query: ListLeadsQueryDto) {
    return this.leadsService.findMine(user.userId, query);
  }

  @Roles(Role.ADMIN)
  @Get()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List all leads for admin users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: LeadStatus })
  @ApiOkResponse({ description: 'Paginated lead list returned successfully' })
  findAll(@Query() query: ListLeadsQueryDto) {
    return this.leadsService.findAll(query);
  }

  @Roles(Role.CLIENT, Role.ADMIN)
  @Get(':id')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get a single lead by id' })
  @ApiParam({ name: 'id', description: 'Lead identifier' })
  @ApiOkResponse({ description: 'Lead returned successfully' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.leadsService.findOneForUser(id, user);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/status')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update the status of a lead' })
  @ApiParam({ name: 'id', description: 'Lead identifier' })
  @ApiBody({ type: UpdateLeadStatusDto })
  @ApiOkResponse({ description: 'Lead status updated successfully' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateLeadStatusDto) {
    return this.leadsService.updateStatus(id, dto);
  }
}
