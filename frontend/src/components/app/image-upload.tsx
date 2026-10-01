"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Mirrors backend/src/question/question-image.storage.ts (IMAGE_UPLOAD_LIMITS).
export const IMAGE_UPLOAD_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  types: ["image/png", "image/jpeg", "image/webp"],
} as const;

interface ImageUploadProps {
  /** The current image URL (null = none). */
  value: string | null;
  onChange: (url: string | null) => void;
  /** Accessible name for the controls ("Question image", "Image for option B"). */
  label: string;
  /** Smaller layout for option rows. */
  compact?: boolean;
  disabled?: boolean;
  /** Reports uploads in flight so the parent form can hold its Save button. */
  onBusyChange?: (busy: boolean) => void;
}

/**
 * Upload with preview, replace and remove. The file is validated here (type, size) for
 * immediate feedback, uploaded to POST /question/images (which re-validates by file signature),
 * and the returned URL becomes the form value — it only sticks once the question is saved.
 */
export function ImageUpload({ value, onChange, label, compact = false, disabled, onBusyChange }: ImageUploadProps) {
  const t = useTranslations("ImageUpload");
  const tCommon = useTranslations("Common");
  const { token } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file || !token) return;
    setError(null);
    if (!(IMAGE_UPLOAD_LIMITS.types as readonly string[]).includes(file.type)) {
      setError(t("typeError"));
      return;
    }
    if (file.size > IMAGE_UPLOAD_LIMITS.maxBytes) {
      setError(t("sizeError"));
      return;
    }
    const body = new FormData();
    body.append("file", file);
    setIsUploading(true);
    onBusyChange?.(true);
    try {
      const { url } = await apiFetch<{ url: string }>("/question/images", { method: "POST", token, body });
      onChange(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsUploading(false);
      onBusyChange?.(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={cn("flex items-start gap-3", compact ? "flex-row" : "flex-col sm:flex-row")}>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-muted",
            compact ? "size-14" : "h-40 w-full sm:w-64",
          )}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={t("previewAlt", { label })} className="size-full object-contain" />
          ) : (
            <ImageIcon className={cn("text-muted-foreground", compact ? "size-5" : "size-8")} aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_UPLOAD_LIMITS.types.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size={compact ? "sm" : "default"}
            onClick={() => inputRef.current?.click()}
            disabled={disabled || isUploading}
            aria-label={`${value ? t("replace") : t("upload")} — ${label}`}
            aria-describedby={error ? errorId : undefined}
          >
            {isUploading ? (
              <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
            ) : (
              <Upload data-icon="inline-start" aria-hidden />
            )}
            {isUploading ? t("uploading") : value ? t("replace") : t("upload")}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size={compact ? "sm" : "default"}
              onClick={() => onChange(null)}
              disabled={disabled || isUploading}
              aria-label={`${t("remove")} — ${label}`}
              className="text-red-600 hover:text-red-700 dark:text-red-400"
            >
              <Trash2 data-icon="inline-start" aria-hidden />
              {t("remove")}
            </Button>
          )}
          {!compact && <p className="w-full text-xs text-muted-foreground">{t("hint")}</p>}
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
