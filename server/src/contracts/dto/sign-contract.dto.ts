import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class SignContractDto {
  @IsBoolean()
  acceptedTerms: boolean;

  @IsString()
  @MaxLength(120)
  signerName: string;
}
