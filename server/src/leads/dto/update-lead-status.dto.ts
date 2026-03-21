import { ApiProperty } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateLeadStatusDto {
  @ApiProperty({
    enum: LeadStatus,
    description: 'Updated status for the lead pipeline',
  })
  @IsEnum(LeadStatus)
  status: LeadStatus;
}
