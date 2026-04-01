import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum LeadSortBy {
  CREATED_AT = 'createdAt',
  EVENT_DATE = 'eventDate',
  BUDGET_MIN = 'budgetMin',
  BUDGET_MAX = 'budgetMax',
  STATUS = 'status',
  LOCATION = 'location',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListLeadsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: LeadStatus,
    description: 'Optional lead status filter',
  })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({
    description:
      'Search across event type, location, notes, and client contact details',
    example: 'Mumbai',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter leads from this event date onwards',
    example: '2026-04-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter leads up to this event date',
    example: '2026-04-30T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Filter by event location',
    example: 'Mumbai',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional({
    description: 'Minimum budget lower bound',
    example: 20000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum budget upper bound',
    example: 50000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMax?: number;

  @ApiPropertyOptional({
    enum: LeadSortBy,
    description: 'Field to sort by',
  })
  @IsOptional()
  @IsEnum(LeadSortBy)
  sortBy?: LeadSortBy = LeadSortBy.CREATED_AT;

  @ApiPropertyOptional({
    enum: SortOrder,
    description: 'Sort direction',
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
