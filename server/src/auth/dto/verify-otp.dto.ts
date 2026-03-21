import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, Length, IsUUID } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    format: 'uuid',
    description: 'OTP challenge identifier returned by send-otp',
  })
  @IsUUID()
  challengeId: string;

  @ApiProperty({
    example: '+919876543210',
    description: 'Phone number tied to the challenge',
  })
  @Matches(/^\+?[1-9]\d{9,14}$/, {
    message: 'phone must be a valid E.164-like phone number',
  })
  phone: string;

  @ApiProperty({
    example: '123456',
    minLength: 4,
    maxLength: 6,
    description: 'One-time password delivered to the user',
  })
  @IsString()
  @Length(4, 6)
  otp: string;
}
