import { IsBooleanString, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListVendorsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  serviceType?: string;

  @IsOptional()
  @IsBooleanString()
  isAvailable?: string;
}
