import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class ContractTemplatePreviewDto {
  @IsUUID()
  proposalId: string;

  @IsString()
  templateId: string;

  @IsOptional()
  @IsObject()
  fields?: Record<string, string>;
}
