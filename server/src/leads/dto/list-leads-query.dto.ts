import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListLeadsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: LeadStatus,
    description: 'Optional lead status filter',
  })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;
}
