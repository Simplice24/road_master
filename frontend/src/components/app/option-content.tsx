import { optionLabel } from "@/lib/utils";
import type { Option } from "@/lib/api-types";

/**
 * An answer option as candidates see it: its letter (derived from display order — the API
 * returns options sorted by position), its text and/or its image (e.g. a road sign).
 */
export function OptionContent({ option, index }: { option: Pick<Option, "text" | "imageUrl">; index: number }) {
  const letter = optionLabel(index);
  return (
    <span className="flex min-w-0 flex-1 items-start gap-3">
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-surface-muted font-mono text-xs font-medium"
      >
        {letter}
      </span>
      <span className="flex min-w-0 flex-col gap-2">
        <span className="sr-only">{letter}. </span>
        {option.text && <span className="text-sm">{option.text}</span>}
        {option.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={option.imageUrl}
            alt={option.text ?? ""}
            className="max-h-32 w-auto max-w-full rounded-md border border-border object-contain"
          />
        )}
      </span>
    </span>
  );
}
