import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePublicBookingDto {
  @ApiProperty({ example: 'Riya Malhotra' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @MaxLength(20)
  phone: string;

  @ApiPropertyOptional({ example: 'riya@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'House Party' })
  @IsString()
  @MaxLength(120)
  eventType: string;

  @ApiProperty({ example: 'Bandra, Mumbai' })
  @IsString()
  @MaxLength(160)
  location: string;

  @ApiPropertyOptional({ example: 'Mumbai' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: 'Signature Cocktail Service' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  packageName?: string;

  @ApiPropertyOptional({ example: 'For 60 guests' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  packageLabel?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Molecular cocktails', 'Champagne wall'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  addOns?: string[];

  @ApiProperty({ example: '2026-05-10T18:30:00.000Z' })
  @IsDateString()
  eventDate: string;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;

  @ApiPropertyOptional({ example: 60000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMin?: number;

  @ApiPropertyOptional({ example: 120000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMax?: number;

  @ApiPropertyOptional({
    example: 'Need a smoked-cocktail ritual at welcome hour.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
