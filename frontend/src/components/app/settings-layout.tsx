"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Building blocks for the cloud.strettch.com "Team settings" / "Account settings" layout used by
 * the exam config and profile pages: a full-bleed grey band holding stacked cards, each with a
 * title + description, its fields, and a grey footer (hint left, "Save changes" right).
 */

// Full-bleed grey band without 100vw overflow: the shadow paints sideways past the container and
// the clip-path trims it to this element's own height.
export const FULL_BLEED = {
  boxShadow: "0 0 0 100vmax var(--surface-muted)",
  clipPath: "inset(0 -100vmax)",
} as const;

interface SettingsSectionProps {
  /** Anchor id (e.g. for "#top-up" links); the sticky header is offset via scroll-margin. */
  id?: string;
  title: string;
  description: string;
  hint: string;
  /** Content shown to the right of the title (e.g. an avatar). */
  aside?: ReactNode;
  children?: ReactNode;
  /** Omit for an informational card with no save button. */
  onSave?: () => Promise<void>;
  readOnly?: boolean;
  dirty?: boolean;
  valid?: boolean;
  /** Footer button text; defaults to "Save changes" / "Saving…". */
  submitLabel?: string;
  submittingLabel?: string;
}

/** One settings card. When `onSave` is given, the card is a form that saves only its own fields. */
export function SettingsSection({
  id,
  title,
  description,
  hint,
  aside,
  children,
  onSave,
  readOnly = false,
  dirty = false,
  valid = true,
  submitLabel,
  submittingLabel,
}: SettingsSectionProps) {
  const tCommon = useTranslations("Common");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSave = !!onSave && !readOnly;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!onSave || !dirty || !valid) return;
    setError(null);
    setIsSaving(true);
    try {
      await onSave();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : tCommon("error");
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  const body = (
    <>
      <div className="flex flex-col gap-5 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-medium">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          {aside}
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {children}
      </div>
      <div className="flex flex-col gap-3 border-t border-border bg-surface-muted/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="text-sm text-muted-foreground">{hint}</p>
        {canSave && (
          <Button type="submit" className="btn-primary h-10 shrink-0 px-5" disabled={!dirty || !valid || isSaving}>
            {isSaving ? (submittingLabel ?? tCommon("saving")) : (submitLabel ?? tCommon("saveChanges"))}
          </Button>
        )}
      </div>
    </>
  );

  return (
    <section id={id} className="scroll-mt-40 overflow-hidden rounded-lg border border-border bg-background">
      {onSave ? (
        <form onSubmit={handleSubmit} noValidate>
          {body}
        </form>
      ) : (
        body
      )}
    </section>
  );
}

interface SettingsFieldProps {
  id: string;
  label: string;
  error?: string;
  /** Short unit shown inside the input on the right (e.g. "%", "RWF"). */
  suffix?: string;
  children: ReactNode;
}

export function SettingsField({ id, label, error, suffix, children }: SettingsFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {children}
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
