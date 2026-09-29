"use client";

import { Suspense, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { useRouter, Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatRwf } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, ExamAttempt, ExamConfig } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/page-header";
import { FULL_BLEED, SettingsField, SettingsSection } from "@/components/app/settings-layout";
import { RequirePermission } from "@/components/app/require-permission";

const ANY_CATEGORY = "any";

function StartExamContent() {
  return (
    <Suspense fallback={null}>
      <StartExamForm />
    </Suspense>
  );
}

function StartExamForm() {
  const t = useTranslations("StartExam");
  const tCommon = useTranslations("Common");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, token, refreshUser, can } = useAuth();
  // The category picker and the in-progress check are optional extras — skip their requests
  // (instead of surfacing 403s) when the role doesn't include them.
  const canPickCategory = can("categories.view");
  const canTopUp = can("transactions.topUpOwn") && can("transactions.viewOwn");

  const { data: examConfigs, isLoading: loadingConfigs } =
    useApi<ExamConfig[]>("/exam-config");
  const { data: categories, isLoading: loadingCategoriesRequest } =
    useApi<Category[]>(canPickCategory ? "/category" : null);
  const loadingCategories = canPickCategory && loadingCategoriesRequest;
  const { data: attempts } = useApi<ExamAttempt[]>(
    can("examAttempts.viewOwn") ? "/exam-attempts" : null,
  );

  const [examConfigId, setExamConfigId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>(
    searchParams.get("categoryId") ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeConfigs = useMemo(
    () => (examConfigs ?? []).filter((config) => config.isActive),
    [examConfigs],
  );
  const categoryOptions = useMemo(
    () => [
      { value: ANY_CATEGORY, label: t("anyCategory") },
      ...(categories ?? []).map((category) => ({
        value: category.id,
        label: category.name,
        description: category.description ?? undefined,
      })),
    ],
    [categories, t],
  );

  const effectiveConfigId = examConfigId || activeConfigs[0]?.id || "";

  const inProgress = attempts?.find((attempt) => attempt.status === "IN_PROGRESS");
  const selectedConfig = activeConfigs.find((config) => config.id === effectiveConfigId);
  const selectedCategory = categories?.find((category) => category.id === categoryId);
  const isFree = !user?.hasUsedFreeExam;
  const price = selectedConfig ? Number(selectedConfig.price) : 0;
  const cost = isFree ? 0 : price;
  const balance = Number(user?.walletBalance ?? 0);
  const insufficientBalance = !isFree && !!user && !!selectedConfig && balance < price;

  async function handleSubmit() {
    if (!token || !selectedConfig) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const attempt = await apiFetch<ExamAttempt>("/exam-attempts", {
        method: "POST",
        token,
        body: {
          examConfigId: selectedConfig.id,
          categoryId: categoryId || undefined,
        },
      });
      await refreshUser();
      router.push(`/exam/${attempt.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLoading = loadingConfigs || loadingCategories;

  return (
    <div className="flex flex-col">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="mt-8 bg-surface-muted py-8" style={FULL_BLEED}>
        {inProgress && (
          <Alert className="mb-6 border-warning/40 bg-background">
            <AlertTriangle className="text-amber-700 dark:text-amber-300" />
            <AlertTitle>{t("inProgressNotice")}</AlertTitle>
            <AlertDescription>
              <Link
                href={`/exam/${inProgress.id}`}
                className="font-mono text-xs tracking-wide text-primary-text uppercase hover:underline"
              >
                {t("resume")}
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex flex-col gap-6">
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
            <Skeleton className="h-80 w-full" />
          </div>
        )}

        {!isLoading && activeConfigs.length === 0 && (
          <p className="rounded-lg border border-border bg-background px-6 py-12 text-center text-sm text-muted-foreground">
            {t("noExamConfigs")}
          </p>
        )}

        {!isLoading && activeConfigs.length > 0 && selectedConfig && (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
            <div className="flex min-w-0 flex-col gap-6">
              <SettingsSection
                title={t("examSectionTitle")}
                description={t("examSectionDescription")}
                hint={t("examSectionHint")}
              >
                <RadioGroup
                  value={effectiveConfigId}
                  onValueChange={setExamConfigId}
                  aria-label={t("examSectionTitle")}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  {activeConfigs.map((config) => (
                    <label
                      key={config.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-surface-muted/60 has-data-checked:border-primary has-data-checked:bg-primary/5"
                    >
                      <RadioGroupItem value={config.id} className="mt-1" />
                      <span className="flex min-w-0 flex-1 flex-col gap-2">
                        <span className="flex items-start justify-between gap-2">
                          <span className="font-medium text-foreground">{config.name}</span>
                          <span className="shrink-0 rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground uppercase">
                            {isFree || Number(config.price) === 0 ? t("free") : formatRwf(config.price)}
                          </span>
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {t("questions", { count: config.numberOfQuestions })} ·{" "}
                          {t("duration", { minutes: config.durationMinutes })} ·{" "}
                          {t("passMark", { percent: config.passMarkPercent })}
                        </span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </SettingsSection>

              {canPickCategory && (
                <SettingsSection
                  title={t("topicSectionTitle")}
                  description={t("topicSectionDescription")}
                  hint={t("topicSectionHint")}
                >
                  <div className="max-w-md">
                    <SettingsField id="category" label={t("category")}>
                      <SearchableSelect
                        id="category"
                        value={categoryId || ANY_CATEGORY}
                        onValueChange={(value) => setCategoryId(value === ANY_CATEGORY ? "" : value)}
                        options={categoryOptions}
                        searchPlaceholder={t("searchCategories")}
                        emptyText={tCommon("noMatches")}
                        className="h-10"
                      />
                    </SettingsField>
                  </div>
                </SettingsSection>
              )}
            </div>

            {/* Summary — sticky beside the options on desktop, last on mobile. */}
            <section
              aria-labelledby="exam-summary-title"
              className="overflow-hidden rounded-lg border border-border bg-background lg:sticky lg:top-40"
            >
              <div className="p-5 sm:p-7">
                <h2 id="exam-summary-title" className="font-display text-xl font-medium">
                  {t("summaryTitle")}
                </h2>
                <dl className="mt-5 flex flex-col divide-y divide-border text-sm">
                  <SummaryRow label={t("summaryExam")}>{selectedConfig.name}</SummaryRow>
                  {canPickCategory && (
                    <SummaryRow label={t("category")}>
                      {selectedCategory?.name ?? t("anyCategory")}
                    </SummaryRow>
                  )}
                  <SummaryRow label={t("summaryQuestions")} mono>
                    {selectedConfig.numberOfQuestions}
                  </SummaryRow>
                  <SummaryRow label={t("summaryTimeLimit")} mono>
                    {t("duration", { minutes: selectedConfig.durationMinutes })}
                  </SummaryRow>
                  <SummaryRow label={t("summaryPassMark")} mono>
                    {selectedConfig.passMarkPercent}%
                  </SummaryRow>
                  <SummaryRow label={t("summaryCost")} mono>
                    {cost === 0 ? t("free") : formatRwf(cost)}
                  </SummaryRow>
                  <SummaryRow label={t("summaryBalanceAfter")} mono>
                    <span className={cn(insufficientBalance && "text-red-700 dark:text-red-300")}>
                      {formatRwf(Math.max(balance - cost, 0))}
                    </span>
                  </SummaryRow>
                </dl>
                {isFree && (
                  <p className="mt-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary-text">
                    {t("freeAttemptNote")}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-border bg-surface-muted/60 px-5 py-4 sm:px-7">
                {insufficientBalance && (
                  <Alert variant="destructive" className="bg-background">
                    <AlertDescription className="flex flex-col gap-2">
                      {t("insufficientBalance")}
                      {canTopUp && (
                        <Link
                          href="/wallet#top-up"
                          className="font-mono text-xs tracking-wide text-primary-text uppercase hover:underline"
                        >
                          {t("topUpCta")}
                        </Link>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                {error && (
                  <Alert variant="destructive" className="bg-background">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button
                  className="btn-primary h-11 w-full"
                  disabled={isSubmitting || insufficientBalance}
                  onClick={handleSubmit}
                >
                  {isSubmitting ? t("starting") : t("start")}
                </Button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, mono = false, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right text-foreground", mono && "font-mono tabular-nums")}>{children}</dd>
    </div>
  );
}

export default function StartExamPage() {
  return (
    <RequirePermission allOf={["examAttempts.start", "examConfig.view"]}>
      <StartExamContent />
    </RequirePermission>
  );
}
