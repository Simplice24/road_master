import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { PlanAccessType } from '../../../generated/prisma/enums';
import type { LocalizedLines, LocalizedText } from '../plan-locales';

// Shape-level checks only. Cross-field rules (default-locale name required, attemptLimit vs
// durationDays per access type, limits) live in plan-validation.ts so create and update — which
// validates the merged row — share them. Limits are mirrored by the frontend plan form.
export class CreatePlanDto {
  @IsObject()
  name!: LocalizedText;

  @IsOptional()
  @IsObject()
  extraFeatures?: LocalizedLines | null;

  @IsInt()
  price!: number;

  @IsEnum(PlanAccessType)
  accessType!: PlanAccessType;

  // null is accepted (and needed when switching access type on update) — "no limit".
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  attemptLimit?: number | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  durationDays?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isMostPopular?: boolean;
}
