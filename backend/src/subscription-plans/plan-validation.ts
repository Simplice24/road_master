import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_LOCALE,
  LocalizedLines,
  LocalizedText,
  PLAN_LIMITS,
  SUPPORTED_LOCALES,
} from './plan-locales';

/** The plan as it will be stored — for an update, the existing row merged with the patch. */
export interface PlanShape {
  name: unknown;
  extraFeatures?: unknown;
  price: unknown;
  accessType: unknown;
  attemptLimit?: unknown;
  durationDays?: unknown;
}

const isInt = (value: unknown, min: number, max: number) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Cross-field rules class-validator can't express on its own. Returns every problem (empty =
 * valid) so the admin form gets them all at once. Pure — unit-tested in plan-validation.spec.ts.
 */
export function planValidationErrors(plan: PlanShape): string[] {
  const errors: string[] = [];

  if (!isPlainObject(plan.name)) {
    errors.push('name must be an object keyed by locale');
  } else {
    for (const [locale, value] of Object.entries(plan.name)) {
      if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
        errors.push(`name: unsupported locale "${locale}"`);
      } else if (
        typeof value !== 'string' ||
        value.length > PLAN_LIMITS.nameMaxLength
      ) {
        errors.push(
          `name.${locale} must be a string of at most ${PLAN_LIMITS.nameMaxLength} characters`,
        );
      }
    }
    const fallback = plan.name[DEFAULT_LOCALE];
    if (typeof fallback !== 'string' || fallback.trim() === '') {
      errors.push(`name.${DEFAULT_LOCALE} is required`);
    }
  }

  if (plan.extraFeatures !== undefined && plan.extraFeatures !== null) {
    if (!isPlainObject(plan.extraFeatures)) {
      errors.push('extraFeatures must be an object keyed by locale');
    } else {
      for (const [locale, lines] of Object.entries(plan.extraFeatures)) {
        if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
          errors.push(`extraFeatures: unsupported locale "${locale}"`);
        } else if (
          !Array.isArray(lines) ||
          lines.length > PLAN_LIMITS.maxFeatures ||
          !lines.every(
            (line) =>
              typeof line === 'string' &&
              line.trim() !== '' &&
              line.length <= PLAN_LIMITS.featureMaxLength,
          )
        ) {
          errors.push(
            `extraFeatures.${locale} must be at most ${PLAN_LIMITS.maxFeatures} non-empty lines of up to ${PLAN_LIMITS.featureMaxLength} characters`,
          );
        }
      }
    }
  }

  if (!isInt(plan.price, PLAN_LIMITS.price.min, PLAN_LIMITS.price.max)) {
    errors.push('price must be a positive whole number of RWF');
  }

  const hasAttempts =
    plan.attemptLimit !== undefined && plan.attemptLimit !== null;
  const hasDuration =
    plan.durationDays !== undefined && plan.durationDays !== null;
  if (plan.accessType === 'ATTEMPTS') {
    if (
      !isInt(
        plan.attemptLimit,
        PLAN_LIMITS.attemptLimit.min,
        PLAN_LIMITS.attemptLimit.max,
      )
    ) {
      errors.push('attempt-based plans require attemptLimit > 0');
    }
    if (hasDuration) {
      errors.push(
        'attempt-based plans never expire and must not have durationDays',
      );
    }
  } else if (plan.accessType === 'TIME') {
    if (
      !isInt(
        plan.durationDays,
        PLAN_LIMITS.durationDays.min,
        PLAN_LIMITS.durationDays.max,
      )
    ) {
      errors.push('time-based plans require durationDays > 0');
    }
    if (hasAttempts) {
      errors.push(
        'time-based plans have unlimited attempts and must not have attemptLimit',
      );
    }
  } else {
    errors.push('accessType must be ATTEMPTS or TIME');
  }

  return errors;
}

export function assertValidPlan(plan: PlanShape): void {
  const errors = planValidationErrors(plan);
  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }
}

/** Drops blank translations so "missing" always means "fall back to the default locale". */
export function cleanLocalizedText(value: LocalizedText): LocalizedText {
  return Object.fromEntries(
    Object.entries(value)
      .map(([locale, text]) => [locale, text?.trim()])
      .filter(([, text]) => !!text),
  ) as LocalizedText;
}

export function cleanLocalizedLines(
  value: LocalizedLines | null | undefined,
): LocalizedLines | null {
  if (!value) return null;
  const cleaned = Object.fromEntries(
    Object.entries(value)
      .map(([locale, lines]) => [
        locale,
        (lines ?? []).map((line) => line.trim()).filter(Boolean),
      ])
      .filter(([, lines]) => lines.length > 0),
  ) as LocalizedLines;
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}
