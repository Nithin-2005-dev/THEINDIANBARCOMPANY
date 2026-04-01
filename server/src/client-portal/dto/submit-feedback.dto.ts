import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SubmitFeedbackDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  testimonial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string;

  @Type(() => Boolean)
  @IsBoolean()
  allowMediaUsage: boolean;
}
