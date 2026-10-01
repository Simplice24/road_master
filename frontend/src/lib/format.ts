export function formatNumber(value: number | string) {
  const num = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-US").format(num);
}

/** Money amounts across the app: thousands separators + currency suffix, e.g. "12,500 RWF". */
export function formatRwf(value: number | string) {
  return `${formatNumber(value)} RWF`;
}

/**
 * The API stores and returns every timestamp in UTC; the app always displays them in Rwanda's
 * time zone (CAT, UTC+2) regardless of the viewer's device settings.
 */
export const DISPLAY_TIME_ZONE = "Africa/Kigali";

export function formatDate(value: string | Date, locale: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: DISPLAY_TIME_ZONE }).format(date);
}

export function formatDateTime(value: string | Date, locale: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(date);
}
