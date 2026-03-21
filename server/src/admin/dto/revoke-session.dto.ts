import { IsString, IsUUID } from 'class-validator';

export class RevokeSessionDto {
  @IsUUID()
  sessionId: string;

  @IsString()
  reason: string;
}
