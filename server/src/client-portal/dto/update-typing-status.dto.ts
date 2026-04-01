import { IsBoolean } from 'class-validator';

export class UpdateTypingStatusDto {
  @IsBoolean()
  isTyping!: boolean;
}
