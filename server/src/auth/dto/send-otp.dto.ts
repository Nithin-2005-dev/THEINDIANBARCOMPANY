import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AuthWorkspaceRole } from '../auth-workspace-role';

export class SendOtpDto {
  @ApiPropertyOptional({
    example: 'client@theindianbarcompany.com',
    description: 'Phone or email identifier used for OTP delivery',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  identifier?: string;

  @ApiPropertyOptional({
    example: '+919876543210',
    description: 'Backward-compatible phone input in E.164-like format',
  })
  @IsOptional()
  @Matches(/^\+?[1-9]\d{9,14}$/, {
    message: 'phone must be a valid E.164-like phone number',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: 'client@theindianbarcompany.com',
    description:
      'Optional email address used for OTP delivery or account linking',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'Nithin',
    description: 'Optional display name captured during OTP initiation',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    enum: AuthWorkspaceRole,
    description: 'Workspace role selected by the user during OTP initiation',
  })
  @IsEnum(AuthWorkspaceRole)
  roleHint: AuthWorkspaceRole;
}
