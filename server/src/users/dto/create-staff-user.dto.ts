import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateStaffUserDto {
  @ApiPropertyOptional({
    example: '+919876543210',
  })
  @IsOptional()
  @Matches(/^\+?[1-9]\d{9,14}$/, {
    message: 'phone must be a valid E.164-like phone number',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: 'ops@theindianbarcompany.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: 'Aarav Singh',
    maxLength: 120,
  })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    enum: Role,
    description: 'Operational role for this staff user',
  })
  @IsEnum(Role)
  role!: Role;
}
