import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  Length,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AuthWorkspaceRole } from '../auth-workspace-role';

export class VerifyOtpDto {
  @ApiProperty({
    format: 'uuid',
    description: 'OTP challenge identifier returned by send-otp',
  })
  @IsUUID()
  challengeId: string;

  @ApiPropertyOptional({
    example: 'client@theindianbarcompany.com',
    description: 'Phone or email identifier tied to the OTP challenge',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  identifier?: string;

  @ApiPropertyOptional({
    example: '+919876543210',
    description: 'Backward-compatible phone number tied to the challenge',
  })
  @IsOptional()
  @Matches(/^\+?[1-9]\d{9,14}$/, {
    message: 'phone must be a valid E.164-like phone number',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: 'client@theindianbarcompany.com',
    description: 'Optional email tied to the challenge',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '123456',
    minLength: 4,
    maxLength: 6,
    description: 'One-time password delivered to the user',
  })
  @IsString()
  @Length(4, 6)
  otp: string;

  @ApiProperty({
    enum: AuthWorkspaceRole,
    description: 'Workspace role selected by the user during OTP verification',
  })
  @IsEnum(AuthWorkspaceRole)
  expectedRole: AuthWorkspaceRole;
}
