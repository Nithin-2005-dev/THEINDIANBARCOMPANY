import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { CreateProposalDto } from './dto/create-proposal.dto';
import { ListProposalsQueryDto } from './dto/list-proposals-query.dto';
import { ProposalDecisionDto } from './dto/proposal-decision.dto';
import { ProposalsService } from './proposals.service';

@Controller('proposals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Roles(Role.ADMIN, Role.SALES)
  @Post()
  create(@Body() dto: CreateProposalDto, @CurrentUser() user: AuthUser) {
    return this.proposalsService.create(dto, user.userId);
  }

  @Roles(Role.CLIENT, Role.ADMIN, Role.SALES, Role.OPS, Role.FINANCE)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListProposalsQueryDto) {
    return this.proposalsService.listForUser(user, query);
  }

  @Roles(Role.CLIENT)
  @Post(':id/decision')
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProposalDecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.proposalsService.decide(id, dto, user);
  }
}
