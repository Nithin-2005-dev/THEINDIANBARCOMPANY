import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePaymentOrderDto {
  @IsUUID()
  paymentId: string;

  @IsOptional()
  @IsString()
  receipt?: string;
}
