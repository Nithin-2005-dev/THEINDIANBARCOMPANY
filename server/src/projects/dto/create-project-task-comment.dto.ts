import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CreateProjectTaskCommentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(3000)
  body!: string;
}
