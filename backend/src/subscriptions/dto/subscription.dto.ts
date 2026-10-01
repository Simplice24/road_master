import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PlanAccessType } from '../../../generated/prisma/enums';
import { PLAN_LIMITS } from '../../subscription-plans/plan-locales';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class PurchasePlanDto {
  @IsUUID()
  planId!: string;
}

/**
 * Either `planId` (snapshot that plan, active or not) or a custom grant (`accessType` plus the
 * matching limit). Granted subscriptions are free (price snapshot 0) and use source ADMIN_GRANT.
 */
export class GrantSubscriptionDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsEnum(PlanAccessType)
  accessType?: PlanAccessType;

  @IsOptional()
  @IsInt()
  @Min(PLAN_LIMITS.attemptLimit.min)
  @Max(PLAN_LIMITS.attemptLimit.max)
  attemptLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(PLAN_LIMITS.durationDays.min)
  @Max(PLAN_LIMITS.durationDays.max)
  durationDays?: number;

  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(500)
  note!: string;
}

export class RevokeSubscriptionDto {
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(500)
  note!: string;

  /** Credit the purchase price back to the wallet (purchases only). */
  @IsOptional()
  @IsBoolean()
  refund?: boolean;
}

/** `days` for time plans, `attempts` for bundles. */
export class ExtendSubscriptionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(PLAN_LIMITS.durationDays.max)
  days?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(PLAN_LIMITS.attemptLimit.max)
  attempts?: number;

  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(500)
  note!: string;
}
