import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CreateLeadNoteDto {
  @ApiProperty({
    example:
      'Client prefers a callback after 6 PM and is leaning toward the premium package.',
    maxLength: 5000,
  })
  @IsString()
  @MaxLength(5000)
  content!: string;
}
