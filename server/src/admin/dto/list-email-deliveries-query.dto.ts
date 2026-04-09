import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListEmailDeliveriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'FAILED',
    description:
      'Filter by delivery status. Supports PENDING, QUEUED, PROCESSING, RETRYING, SENT, or FAILED.',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    example: 'BOOKING_CONFIRMATION',
    description: 'Filter by normalized email type.',
  })
  @IsOptional()
  @IsString()
  emailType?: string;

  @ApiPropertyOptional({
    example: 'riya@example.com',
    description:
      'Search by recipient, email type, provider id, related booking/project ids, or user identity.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: '2026-04-01T00:00:00.000Z',
    description: 'Include emails created on or after this timestamp.',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    example: '2026-04-05T23:59:59.999Z',
    description: 'Include emails created on or before this timestamp.',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
