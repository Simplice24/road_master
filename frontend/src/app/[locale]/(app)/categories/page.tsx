"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Link } from "@/i18n/navigation";
import { useApi } from "@/lib/use-api";
import type { Category } from "@/lib/api-types";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/page-header";
import { FULL_BLEED } from "@/components/app/settings-layout";
import { RequirePermission } from "@/components/app/require-permission";

function CategoriesContent() {
  const t = useTranslations("CategoryBrowser");
  const tCommon = useTranslations("Common");
  const { data: categories, error, isLoading } = useApi<Category[]>("/category");
  const canStartExam = useAuth().can("examAttempts.start");
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () => [...(categories ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );
  const needle = query.trim().toLowerCase();
  // Name-only, like the searchable selects — long descriptions produce surprising matches.
  const visible = needle
    ? sorted.filter((category) => category.name.toLowerCase().includes(needle))
    : sorted;

  return (
    <div className="flex flex-col">
      <PageHeader backHref="/dashboard" title={t("title")} subtitle={t("subtitle")} />

      <div className="mt-8 bg-surface-muted py-8" style={FULL_BLEED}>
        {error && (
          <Alert variant="destructive" className="mb-6 bg-background">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="h-10 bg-background pl-9"
            />
          </div>
          {!isLoading && (
            <p className="font-mono text-xs text-muted-foreground" aria-live="polite">
              {t("count", { count: visible.length })}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isLoading &&
            Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-52 w-full" />)}

          {!isLoading && visible.length === 0 && (
            <p className="col-span-full rounded-lg border border-border bg-background px-6 py-12 text-center text-sm text-muted-foreground">
              {sorted.length === 0 ? t("noCategories") : tCommon("noMatches")}
            </p>
          )}

          {!isLoading &&
            visible.map((category) => (
              <article
                key={category.id}
                className="flex flex-col overflow-hidden rounded-lg border border-border bg-background"
              >
                <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {String(sorted.indexOf(category) + 1).padStart(2, "0")}
                  </span>
                  <h2 className="font-display text-lg leading-snug font-medium text-foreground">{category.name}</h2>
                  {category.description && (
                    <p className="line-clamp-4 text-sm text-muted-foreground">{category.description}</p>
                  )}
                </div>
                {canStartExam && (
                  <Link
                    href={`/exam/start?categoryId=${category.id}`}
                    className="group flex items-center justify-between border-t border-border bg-surface-muted/60 px-5 py-3.5 font-mono text-xs tracking-wide text-primary-text uppercase transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none sm:px-6"
                  >
                    {t("practiceThisTopic")}
                    <ArrowRight
                      aria-hidden
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                )}
              </article>
            ))}
        </div>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <RequirePermission anyOf={["categories.view"]}>
      <CategoriesContent />
    </RequirePermission>
  );
}
