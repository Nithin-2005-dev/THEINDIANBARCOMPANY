import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLeadManualActivityDto {
  @ApiProperty({
    example:
      'Spoke with client and confirmed the site visit for Sunday evening.',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiProperty({
    required: false,
    example: {
      channel: 'call',
      outcome: 'site-visit-confirmed',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
