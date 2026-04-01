import { Type } from 'class-transformer';
import {
  IsString,
  MaxLength,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { AssistantContextDto } from './assistant-context.dto';

export class SendAssistantMessageDto {
  @IsString()
  @MaxLength(4000)
  content: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AssistantContextDto)
  context?: AssistantContextDto;
}
