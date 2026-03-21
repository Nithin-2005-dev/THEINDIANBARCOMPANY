import { ProposalStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ProposalDecisionDto {
  @IsEnum(ProposalStatus)
  status: ProposalStatus;
}
