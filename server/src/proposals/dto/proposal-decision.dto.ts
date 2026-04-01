import { ProposalStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ProposalDecisionDto {
  @IsEnum(ProposalStatus)
  status: ProposalStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
