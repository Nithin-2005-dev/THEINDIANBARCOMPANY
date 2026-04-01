import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateLeadDto } from './create-lead.dto';

export class CreateOfflineLeadDto extends CreateLeadDto {
  @ApiProperty({
    example: 'Riya Malhotra',
    maxLength: 120,
  })
  @IsString()
  @MaxLength(120)
  clientName: string;

  @ApiProperty({
    example: 'riya@example.com',
  })
  @IsEmail()
  @MaxLength(160)
  clientEmail: string;

  @ApiPropertyOptional({
    example: '+919876543210',
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  clientPhone?: string;
}
