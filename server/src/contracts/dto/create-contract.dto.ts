import { ContractStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUrl, IsUUID } from 'class-validator';

export class CreateContractDto {
  @IsUUID()
  proposalId: string;

  @IsUrl({
    require_protocol: true,
  })
  documentUrl: string;

  @IsOptional()
  @IsEnum(ContractStatus)
  status: ContractStatus;
}
