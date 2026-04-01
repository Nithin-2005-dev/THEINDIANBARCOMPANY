import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const assistantAnalyticsRanges = ['7d', '30d'] as const;
const assistantAnalyticsRoles = ['all', ...Object.values(Role)] as const;

export type AssistantAnalyticsRange = (typeof assistantAnalyticsRanges)[number];
export type AssistantAnalyticsRoleFilter =
  (typeof assistantAnalyticsRoles)[number];

export class AssistantAnalyticsQueryDto {
  @IsOptional()
  @IsIn(assistantAnalyticsRanges)
  range?: AssistantAnalyticsRange;

  @IsOptional()
  @IsIn(assistantAnalyticsRoles)
  role?: AssistantAnalyticsRoleFilter;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  pageKey?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  @IsString()
  @MaxLength(120)
  search?: string;
}
