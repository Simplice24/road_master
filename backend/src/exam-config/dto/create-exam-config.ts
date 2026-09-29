import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Limits are mirrored by the frontend exam-config form — keep the two in sync.
export const EXAM_CONFIG_LIMITS = {
  nameMaxLength: 100,
  numberOfQuestions: { min: 1, max: 100 },
  passMarkPercent: { min: 0, max: 100 },
  durationMinutes: { min: 1, max: 300 },
  price: { min: 0, max: 99_999_999.99 }, // Decimal(10, 2)
} as const;

export class CreateExamConfigDto {
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(EXAM_CONFIG_LIMITS.nameMaxLength)
  name!: string;

  @IsInt()
  @Min(EXAM_CONFIG_LIMITS.numberOfQuestions.min)
  @Max(EXAM_CONFIG_LIMITS.numberOfQuestions.max)
  numberOfQuestions!: number;

  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(EXAM_CONFIG_LIMITS.price.min)
  @Max(EXAM_CONFIG_LIMITS.price.max)
  price!: number;

  @IsInt()
  @Min(EXAM_CONFIG_LIMITS.passMarkPercent.min)
  @Max(EXAM_CONFIG_LIMITS.passMarkPercent.max)
  passMarkPercent!: number;

  @IsInt()
  @Min(EXAM_CONFIG_LIMITS.durationMinutes.min)
  @Max(EXAM_CONFIG_LIMITS.durationMinutes.max)
  durationMinutes!: number;

  @IsBoolean()
  isActive!: boolean;
}
