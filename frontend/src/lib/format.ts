export function formatNumber(value: number | string) {
  const num = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-US").format(num);
}

/** Money amounts across the app: thousands separators + currency suffix, e.g. "12,500 RWF". */
export function formatRwf(value: number | string) {
  return `${formatNumber(value)} RWF`;
}

export function formatDate(value: string | Date, locale: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

export function formatDateTime(value: string | Date, locale: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
