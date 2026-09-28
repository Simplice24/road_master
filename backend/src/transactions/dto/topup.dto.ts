import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class TopUpDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  providerRef?: string;
}
