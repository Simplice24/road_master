"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

/**
 * Prev/next pager under a DataTable: mono "1–20 of 287" range on the left, outline buttons on
 * the right. Renders nothing for an empty result.
 */
export function Pagination({ page, pageSize, total, onPageChange, disabled }: PaginationProps) {
  const t = useTranslations("Pagination");
  if (total === 0) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav aria-label={t("label")} className="flex flex-wrap items-center justify-between gap-3">
      <p className="font-mono text-xs text-muted-foreground tabular-nums" aria-live="polite">
        {t("range", { from, to, total })}
      </p>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {t("page", { page, pageCount })}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
        >
          <ChevronLeft data-icon="inline-start" aria-hidden />
          {t("previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= pageCount}
        >
          {t("next")}
          <ChevronRight data-icon="inline-end" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
