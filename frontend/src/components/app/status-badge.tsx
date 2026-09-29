import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "neutral";

// Tinted pill with a matching 1px border, mirroring the reference's "RUNNING" badge. Text uses
// the -700/-300 shades (not the raw --success/--warning tokens) to keep 4.5:1 contrast at 11px.
const TONE_CLASSES: Record<StatusTone, string> = {
  success:
    "border-success/40 bg-success/10 text-emerald-700 dark:text-emerald-300",
  warning:
    "border-warning/40 bg-warning/10 text-amber-700 dark:text-amber-300",
  danger:
    "border-destructive/40 bg-destructive/10 text-red-700 dark:text-red-300",
  neutral: "border-border bg-surface-muted text-muted-foreground",
};

interface StatusBadgeProps {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}

export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-sm border px-2 font-mono text-[11px] font-medium tracking-wide whitespace-nowrap uppercase",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
