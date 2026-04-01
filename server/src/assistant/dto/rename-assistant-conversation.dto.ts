import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class RenameAssistantConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}
