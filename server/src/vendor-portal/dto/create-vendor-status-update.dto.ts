import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStage } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVendorStatusUpdateDto {
  @ApiPropertyOptional({ enum: ProjectStage })
  @IsOptional()
  @IsEnum(ProjectStage)
  stage?: ProjectStage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;
}
