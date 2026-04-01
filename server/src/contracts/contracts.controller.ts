import {
  Body,
  Controller,
  Get,
  Headers,
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
import { CreateUploadUrlDto } from '../storage/dto/create-upload-url.dto';
import { ContractTemplatePreviewDto } from './dto/contract-template-preview.dto';
import { CreateContractFromTemplateDto } from './dto/create-contract-from-template.dto';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { SignContractDto } from './dto/sign-contract.dto';
import { UpdateContractStatusDto } from './dto/update-contract-status.dto';

@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Roles(Role.ADMIN, Role.SALES, Role.OPS)
  @Post()
  create(
    @Body() dto: CreateContractDto,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.contractsService.create(dto, user.userId, idempotencyKey);
  }

  @Roles(Role.ADMIN, Role.SALES, Role.OPS)
  @Get('templates')
  listTemplates() {
    return this.contractsService.listTemplates();
  }

  @Roles(Role.ADMIN, Role.SALES, Role.OPS)
  @Post('templates/preview')
  previewTemplate(@Body() dto: ContractTemplatePreviewDto) {
    return this.contractsService.previewTemplate(dto);
  }

  @Roles(Role.ADMIN, Role.SALES, Role.OPS)
  @Post('templates/create')
  createFromTemplate(
    @Body() dto: CreateContractFromTemplateDto,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.contractsService.createFromTemplate(
      dto,
      user.userId,
      idempotencyKey,
    );
  }

  @Roles(Role.CLIENT, Role.ADMIN, Role.SALES, Role.OPS, Role.FINANCE)
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.contractsService.listForUser(user);
  }

  @Roles(Role.ADMIN, Role.SALES, Role.OPS)
  @Post('proposals/:proposalId/draft-document-upload-url')
  createDraftDocumentUploadUrl(
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @Body() dto: CreateUploadUrlDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contractsService.createDraftDocumentUploadUrl(
      proposalId,
      dto,
      user,
    );
  }

  @Roles(Role.ADMIN, Role.OPS)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractStatusDto,
  ) {
    return this.contractsService.updateStatus(id, dto);
  }

  @Roles(Role.CLIENT)
  @Post(':id/sign')
  sign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SignContractDto,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.contractsService.sign(id, dto, user, idempotencyKey);
  }

  @Roles(Role.CLIENT, Role.ADMIN, Role.SALES, Role.OPS)
  @Post(':id/document-upload-url')
  createDocumentUploadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateUploadUrlDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contractsService.createDocumentUploadUrl(id, dto, user);
  }

  @Roles(Role.CLIENT, Role.ADMIN, Role.SALES, Role.OPS, Role.FINANCE)
  @Get(':id/versions')
  listVersions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contractsService.listVersions(id, user);
  }

  @Roles(Role.CLIENT, Role.ADMIN, Role.SALES, Role.OPS, Role.FINANCE)
  @Get(':id/document-access-url')
  createDocumentAccessUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contractsService.createDocumentAccessUrl(id, user);
  }
}
