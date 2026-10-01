export { cn } from "cn"

/**
 * A, B, C… for an option at `index` in display order. Labels are always derived from the
 * current order at render time — never stored — so reordering can't desynchronise them.
 */
export function optionLabel(index: number) {
  return String.fromCharCode(65 + index);
}
