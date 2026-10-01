/**
 * Locales plan names / extra features can be translated into. Mirrors
 * frontend/src/i18n/routing.ts — keep the two lists in sync. The default locale is the only
 * required translation and the fallback when another is missing.
 */
export const SUPPORTED_LOCALES = ['en', 'rw', 'fr'] as const;
export type PlanLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: PlanLocale = 'en';

export type LocalizedText = Partial<Record<PlanLocale, string>>;
export type LocalizedLines = Partial<Record<PlanLocale, string[]>>;

export const PLAN_LIMITS = {
  nameMaxLength: 60,
  featureMaxLength: 120,
  maxFeatures: 8,
  price: { min: 1, max: 99_999_999 }, // whole RWF; matches the wallet's Decimal(10, 2) ceiling
  attemptLimit: { min: 1, max: 10_000 },
  durationDays: { min: 1, max: 3_650 },
} as const;
