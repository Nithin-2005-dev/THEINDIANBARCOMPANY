import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @MaxLength(4000)
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  attachmentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  attachmentKey?: string;

  @IsOptional()
  @IsUrl({
    require_protocol: true,
  })
  attachmentUrl?: string;
}
