import { ContractStatus } from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateContractFromTemplateDto {
  @IsUUID()
  proposalId: string;

  @IsString()
  templateId: string;

  @IsOptional()
  @IsObject()
  fields?: Record<string, string>;

  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;
}
