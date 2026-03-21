import { IsInt, IsString, Max, Min } from 'class-validator';

export class CreateUploadUrlDto {
  @IsString()
  fileName: string;

  @IsString()
  contentType: string;

  @IsInt()
  @Min(1)
  @Max(25_000_000)
  sizeBytes: number;
}
