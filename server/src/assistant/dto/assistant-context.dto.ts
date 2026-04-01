import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AssistantContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  pagePath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  pageTitle?: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
