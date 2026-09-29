"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { formatRwf } from "@/lib/format";
import type { ExamAttempt } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { AttemptsTable } from "@/components/app/attempts-table";
import { Plus } from "lucide-react";

function StatTile({
  label,
  value,
  action,
  highlight = false,
}: {
  label: string;
  value: ReactNode;
  action?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-5",
        highlight ? "border-primary/30 bg-primary/5" : "border-border bg-background",
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-mono text-2xl font-medium text-foreground tabular-nums">{value}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const { user, can } = useAuth();
  // Every section below is shown only if the user may use it — a role with no permissions
  // still gets a working (if sparse) dashboard rather than a wall of 403 errors.
  const canViewAttempts = can("examAttempts.viewOwn");
  const canStartExam = can("examAttempts.start");
  const canTopUp = can("transactions.topUpOwn") && can("transactions.viewOwn");
  const { data: attempts, isLoading } = useApi<ExamAttempt[]>(
    canViewAttempts ? "/exam-attempts" : null,
  );

  const sorted = attempts
    ? [...attempts].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
    : [];
  const recent = sorted.slice(0, 5);
  const completed = sorted.filter((attempt) => attempt.status === "COMPLETED");
  const passRate =
    completed.length > 0
      ? Math.round(
          (completed.filter((attempt) => attempt.passed).length / completed.length) * 100,
        )
      : null;

  if (!user) return null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("welcomeBack", { name: user.fullName.split(" ")[0] })}
        subtitle={t("subtitle")}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t("walletBalance")}
          value={formatRwf(user.walletBalance)}
          action={
            canTopUp && (
              // Same pill as the top bar's balance widget: tinted, mono, "+" on the left.
              <Link
                href="/wallet#top-up"
                className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-primary/10 px-3 font-mono text-xs font-medium text-primary-text transition-colors hover:bg-primary/15 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Plus className="size-3.5" aria-hidden />
                {t("topUp")}
              </Link>
            )
          }
        />
        {canViewAttempts && (
          <>
            <StatTile label={t("attemptsTaken")} value={isLoading ? "…" : sorted.length} />
            <StatTile
              label={t("passRate")}
              value={isLoading ? "…" : passRate === null ? "—" : `${passRate}%`}
            />
          </>
        )}
        {canStartExam && (
          <StatTile
            highlight
            label={user.hasUsedFreeExam ? t("freeExamUsed") : t("freeExamAvailable")}
            value={user.hasUsedFreeExam ? "—" : "🎉"}
          />
        )}
      </div>

      {canViewAttempts && (
        <section aria-labelledby="recent-attempts-title" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="recent-attempts-title" className="font-display text-xl font-medium">
              {t("recentAttempts")}
            </h2>
            <Link
              href="/history"
              className="rounded-sm font-mono text-xs tracking-wide text-primary-text uppercase hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {t("viewAll")}
            </Link>
          </div>
          <AttemptsTable
            attempts={recent}
            isLoading={isLoading}
            caption={t("recentAttempts")}
            emptyMessage={
              <span className="flex flex-col items-center gap-3">
                {t("noAttemptsYet")}
                {canStartExam && (
                  <Button size="sm" className="btn-primary h-9 px-4 text-xs" render={<Link href="/exam/start" />} nativeButton={false}>
                    {t("takeFirstExam")}
                  </Button>
                )}
              </span>
            }
          />
        </section>
      )}
    </div>
  );
}
