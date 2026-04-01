import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';
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

export enum ProjectSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  PROGRESS = 'progress',
  STATUS = 'status',
  EVENT_DATE = 'eventDate',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListProjectsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ProjectStatus,
    description: 'Optional project status filter',
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({
    description: 'Search across project summary, lead, and client details',
    example: 'wedding',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by lead event date from this timestamp',
    example: '2026-04-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter by lead event date up to this timestamp',
    example: '2026-04-30T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Filter by event location',
    example: 'Goa',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional({
    description: 'Minimum budget lower bound from linked lead',
    example: 50000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum budget upper bound from linked lead',
    example: 150000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMax?: number;

  @ApiPropertyOptional({
    enum: ProjectSortBy,
    description: 'Field to sort by',
  })
  @IsOptional()
  @IsEnum(ProjectSortBy)
  sortBy?: ProjectSortBy = ProjectSortBy.CREATED_AT;

  @ApiPropertyOptional({
    enum: SortOrder,
    description: 'Sort direction',
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
