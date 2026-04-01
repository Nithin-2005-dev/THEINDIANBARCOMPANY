import { TeamCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTeamMemberDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(120)
  designation: string;

  @IsEnum(TeamCategory)
  category: TeamCategory;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  photoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  photoPublicId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  instagramUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  linkedInUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  websiteUrl?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
