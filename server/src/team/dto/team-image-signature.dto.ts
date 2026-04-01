import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class TeamImageSignatureDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fileName?: string;

  @IsString()
  @MaxLength(80)
  contentType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes: number;
}
