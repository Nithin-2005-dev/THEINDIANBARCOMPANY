import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLeadDto {
  @ApiProperty({
    example: 'Corporate Cocktail Night',
    maxLength: 120,
  })
  @IsString()
  @MaxLength(120)
  eventType: string;

  @ApiProperty({
    example: 'Indiranagar Rooftop, Bangalore',
    maxLength: 160,
  })
  @IsString()
  @MaxLength(160)
  location: string;

  @ApiPropertyOptional({
    example: 'Bangalore',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiProperty({
    example: '2026-05-10T18:30:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  eventDate: string;

  @ApiPropertyOptional({
    example: 120,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guestCount?: number;

  @ApiPropertyOptional({
    example: 50000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMin?: number;

  @ApiPropertyOptional({
    example: 150000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMax?: number;

  @ApiPropertyOptional({
    example: 'Need flair bartenders, premium glassware, and a mocktail counter.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
