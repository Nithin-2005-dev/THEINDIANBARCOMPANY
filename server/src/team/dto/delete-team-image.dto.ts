import { IsString, MaxLength } from 'class-validator';

export class DeleteTeamImageDto {
  @IsString()
  @MaxLength(220)
  publicId: string;
}
