import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class AdjustBalanceDto {
  @IsUUID()
  userId!: string;

  /** Signed whole RWF: positive credits the wallet, negative debits it. */
  @IsInt()
  @NotEquals(0)
  @Min(-99_999_999)
  @Max(99_999_999)
  amount!: number;

  // Required — every manual balance change must say why.
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(500)
  note!: string;
}
