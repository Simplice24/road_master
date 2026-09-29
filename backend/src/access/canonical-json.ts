/** Key-order-independent serialization, for deep-equality checks on JSON columns (MySQL can't
 * index or compare Json columns for equality, so matching `conditions` happens in code). */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${canonicalJson(val)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
