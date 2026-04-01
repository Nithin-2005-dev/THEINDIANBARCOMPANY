import { ProjectStage } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProjectUpdateDto {
  @IsEnum(ProjectStage)
  stage: ProjectStage;

  @IsString()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
