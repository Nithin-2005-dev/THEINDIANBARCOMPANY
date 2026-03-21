import { ProposalStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProposalDto {
  @IsUUID()
  leadId: string;

  @IsString()
  @MaxLength(120)
  title: string;

  @IsInt()
  @Min(0)
  price: number;

  @IsString()
  scope: string;

  @IsString()
  deliverables: string;

  @IsString()
  @MaxLength(500)
  timeline: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(ProposalStatus)
  status?: ProposalStatus;
}
