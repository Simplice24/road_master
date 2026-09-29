/**
 * Mirrors backend/src/exam-config/dto/create-exam-config.ts (EXAM_CONFIG_LIMITS) — keep the two
 * in sync. Client-side checks are for immediate feedback only; the API validates again.
 */
export const EXAM_CONFIG_LIMITS = {
  nameMaxLength: 100,
  numberOfQuestions: { min: 1, max: 100 },
  passMarkPercent: { min: 0, max: 100 },
  durationMinutes: { min: 1, max: 300 },
  price: { min: 0, max: 99_999_999.99 },
} as const;

/** A validation failure as a translation key (under ExamConfig.errors) plus its values. */
export interface FieldError {
  key: "required" | "integer" | "range" | "decimals" | "maxLength";
  values?: Record<string, string | number>;
}

export function validateName(value: string): FieldError | null {
  const trimmed = value.trim();
  if (!trimmed) return { key: "required" };
  if (trimmed.length > EXAM_CONFIG_LIMITS.nameMaxLength) {
    return { key: "maxLength", values: { max: EXAM_CONFIG_LIMITS.nameMaxLength } };
  }
  return null;
}

export function validateInteger(
  value: string,
  { min, max }: { min: number; max: number },
): FieldError | null {
  if (value.trim() === "") return { key: "required" };
  const number = Number(value);
  if (!Number.isInteger(number)) return { key: "integer" };
  if (number < min || number > max) return { key: "range", values: { min, max } };
  return null;
}

export function validatePrice(value: string): FieldError | null {
  if (value.trim() === "") return { key: "required" };
  const number = Number(value);
  const { min, max } = EXAM_CONFIG_LIMITS.price;
  if (!Number.isFinite(number) || number < min || number > max) {
    return { key: "range", values: { min, max: "99,999,999.99" } };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return { key: "decimals" };
  return null;
}
