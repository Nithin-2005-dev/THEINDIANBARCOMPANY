import { Body, Controller, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { CreateUploadUrlDto } from '../storage/dto/create-upload-url.dto';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractStatusDto } from './dto/update-contract-status.dto';

@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateContractDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.contractsService.create(dto, idempotencyKey);
  }

  @Roles(Role.CLIENT, Role.ADMIN)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.contractsService.listForUser(user);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateContractStatusDto) {
    return this.contractsService.updateStatus(id, dto);
  }

  @Roles(Role.CLIENT)
  @Post(':id/sign')
  sign(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.contractsService.sign(id, user, idempotencyKey);
  }

  @Roles(Role.CLIENT, Role.ADMIN)
  @Post(':id/document-upload-url')
  createDocumentUploadUrl(
    @Param('id') id: string,
    @Body() dto: CreateUploadUrlDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contractsService.createDocumentUploadUrl(id, dto, user);
  }
}
