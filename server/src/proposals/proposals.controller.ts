import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateProposalDto) {
    return this.proposalsService.create(dto);
  }

  @Roles(Role.CLIENT, Role.ADMIN)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListProposalsQueryDto) {
    return this.proposalsService.listForUser(user, query);
  }

  @Roles(Role.CLIENT)
  @Post(':id/decision')
  decide(
    @Param('id') id: string,
    @Body() dto: ProposalDecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.proposalsService.decide(id, dto, user);
  }
}
