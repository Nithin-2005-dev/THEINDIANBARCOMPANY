import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateUploadUrlDto } from '../../storage/dto/create-upload-url.dto';

export class CreateProjectDocumentUploadDto extends CreateUploadUrlDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;
}
