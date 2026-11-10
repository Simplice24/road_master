import {
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export const TOPUP_PROVIDERS = ['MTN_MOMO', 'AIRTEL_MONEY', 'CARD'] as const;
export type TopUpProvider = (typeof TOPUP_PROVIDERS)[number];

export const CARD_BRANDS = ['VISA', 'MASTERCARD'] as const;

// Rwandan mobile-money prefixes: MTN 078/079, Airtel 072/073.
export const MOBILE_MONEY_PREFIXES: Record<
  Exclude<TopUpProvider, 'CARD'>,
  string[]
> = {
  MTN_MOMO: ['078', '079'],
  AIRTEL_MONEY: ['072', '073'],
};

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Stored in one canonical local form (07XXXXXXXX) so reconciliation can match gateway exports
// whether the payer typed "+250 788 ...", "250788..." or "0788...".
const normalizePhone = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const digits = value.replace(/[\s()-]/g, '').replace(/^\+/, '');
  return digits.startsWith('250') ? `0${digits.slice(3)}` : digits;
};

const isMobileMoney = (dto: TopUpDto) =>
  dto.provider === 'MTN_MOMO' || dto.provider === 'AIRTEL_MONEY';
const isCard = (dto: TopUpDto) => dto.provider === 'CARD';

/**
 * A wallet top-up and the payer details used for it, kept for reconciliation against the
 * gateway's statements. Cards never carry the full number or CVV — the frontend sends only
 * what a receipt would show (brand, last 4, expiry, holder name), keeping this API out of
 * PCI DSS cardholder-data scope.
 */
export class TopUpDto {
  // Whole RWF only — the frontend already enforced this; now the API does too.
  @IsInt()
  @IsPositive()
  @Max(99_999_999)
  amount!: number;

  @IsIn(TOPUP_PROVIDERS)
  provider!: TopUpProvider;

  @IsOptional()
  @IsString()
  providerRef?: string;

  // The network-specific prefix (MTN vs Airtel) is checked in TransactionsService#topUp.
  @ValidateIf(isMobileMoney)
  @Transform(normalizePhone)
  @IsString()
  @Matches(/^07\d{8}$/, {
    message: 'payerPhone must be a Rwandan mobile number (07XXXXXXXX)',
  })
  payerPhone?: string;

  @ValidateIf(isCard)
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  cardHolderName?: string;

  @ValidateIf(isCard)
  @IsIn(CARD_BRANDS)
  cardBrand?: (typeof CARD_BRANDS)[number];

  @ValidateIf(isCard)
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'cardLast4 must be 4 digits' })
  cardLast4?: string;

  @ValidateIf(isCard)
  @IsInt()
  @Min(1)
  @Max(12)
  cardExpiryMonth?: number;

  @ValidateIf(isCard)
  @IsInt()
  @Min(2000)
  @Max(2099)
  cardExpiryYear?: number;
}
