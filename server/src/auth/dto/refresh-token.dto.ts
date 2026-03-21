import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token issued during login or a previous refresh',
  })
  @IsString()
  refreshToken: string;

  @ApiProperty({
    example: 'device-web-chrome-01',
    description: 'Client device fingerprint used for session validation',
  })
  @IsString()
  deviceFingerprint: string;
}
