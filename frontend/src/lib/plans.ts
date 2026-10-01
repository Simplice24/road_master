import { routing } from "@/i18n/routing";
import type { LocalizedLines, LocalizedText, PlanAccessType } from "@/lib/api-types";

/**
 * Plan names and extra feature lines are admin-entered per locale. A missing translation
 * falls back to the default locale ("en" — the only one the API requires).
 */
export function localized(text: LocalizedText | null | undefined, locale: string): string {
  return text?.[locale] || text?.[routing.defaultLocale] || "";
}

export function localizedLines(lines: LocalizedLines | null | undefined, locale: string): string[] {
  const own = lines?.[locale];
  return own && own.length > 0 ? own : (lines?.[routing.defaultLocale] ?? []);
}

/** The fields feature lines are generated from — a catalog plan or a purchase snapshot. */
export interface PlanTerms {
  accessType: PlanAccessType;
  attemptLimit: number | null;
  durationDays: number | null;
  extraFeatures?: LocalizedLines | null;
}

/**
 * Translation function shape shared by next-intl's server `getTranslations("Pricing")` and
 * client `useTranslations("Pricing")`, so the landing page, the in-app pricing page and the
 * admin live preview all generate identical lines.
 */
type PricingT = (key: string, values?: Record<string, string | number>) => string;

/**
 * Feature lines are built at render time from the plan's terms + i18n templates (never stored),
 * so they stay correct in every language when an admin edits a plan. Admin-entered extra lines
 * for the current locale are appended.
 */
export function planFeatureLines(plan: PlanTerms, t: PricingT, locale: string): string[] {
  const generated =
    plan.accessType === "ATTEMPTS"
      ? [
          t("features.attempts", { count: plan.attemptLimit ?? 0 }),
          t("features.neverExpires"),
        ]
      : [
          t("features.unlimited"),
          t("features.validDays", { days: plan.durationDays ?? 0 }),
        ];
  return [...generated, ...localizedLines(plan.extraFeatures, locale)];
}

/**
 * Mirrors backend/src/subscription-plans/plan-locales.ts (PLAN_LIMITS) — keep the two in sync.
 * Client-side checks are for immediate feedback only; the API validates again.
 */
export const PLAN_LIMITS = {
  nameMaxLength: 60,
  featureMaxLength: 120,
  maxFeatures: 8,
  price: { min: 1, max: 99_999_999 },
  attemptLimit: { min: 1, max: 10_000 },
  durationDays: { min: 1, max: 3_650 },
} as const;

/** A validation failure as a translation key (under PlanForm.errors) plus its values. */
export interface PlanFieldError {
  key: "required" | "integer" | "range" | "maxLength" | "tooManyLines";
  values?: Record<string, string | number>;
}

export function validateWholeNumber(
  value: string,
  { min, max }: { min: number; max: number },
): PlanFieldError | null {
  if (value.trim() === "") return { key: "required" };
  const number = Number(value);
  if (!Number.isInteger(number)) return { key: "integer" };
  if (number < min || number > max) return { key: "range", values: { min, max } };
  return null;
}

export function validatePlanName(value: string, required: boolean): PlanFieldError | null {
  const trimmed = value.trim();
  if (!trimmed) return required ? { key: "required" } : null;
  if (trimmed.length > PLAN_LIMITS.nameMaxLength) {
    return { key: "maxLength", values: { max: PLAN_LIMITS.nameMaxLength } };
  }
  return null;
}

/** Extra features are edited as one line per row of a textarea; blank rows are ignored. */
export function featureTextToLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function validateFeatureText(text: string): PlanFieldError | null {
  const lines = featureTextToLines(text);
  if (lines.length > PLAN_LIMITS.maxFeatures) {
    return { key: "tooManyLines", values: { max: PLAN_LIMITS.maxFeatures } };
  }
  if (lines.some((line) => line.length > PLAN_LIMITS.featureMaxLength)) {
    return { key: "maxLength", values: { max: PLAN_LIMITS.featureMaxLength } };
  }
  return null;
}
