import { IsInt, IsOptional, IsPositive, IsString, Max } from 'class-validator';

export class TopUpDto {
  // Whole RWF only — the frontend already enforced this; now the API does too.
  @IsInt()
  @IsPositive()
  @Max(99_999_999)
  amount!: number;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  providerRef?: string;
}
