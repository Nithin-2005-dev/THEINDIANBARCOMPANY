import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class TrackAssistantEventDto {
  @IsString()
  @MaxLength(80)
  eventType: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsUUID()
  messageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  pageKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  section?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  intent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  contentSnippet?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
