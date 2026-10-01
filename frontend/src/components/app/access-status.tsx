"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/format";
import { localized } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { AccessSummary, SubscriptionSummary } from "@/lib/api-types";
import { StatusBadge } from "@/components/app/status-badge";

/** A snapshot's display name; custom admin grants have no catalog name. */
export function useSubscriptionName() {
  const t = useTranslations("AccessStatus");
  const locale = useLocale();
  return (subscription: Pick<SubscriptionSummary, "planName">) =>
    localized(subscription.planName, locale) || t("customGrant");
}

/**
 * The one-line exam-access state, in priority order: an active time plan (bundle attempts are
 * paused meanwhile), a queued time plan, bundle attempts, the free first exam, or nothing.
 */
function useAccessLine(access: AccessSummary) {
  const t = useTranslations("AccessStatus");
  const locale = useLocale();

  if (access.activeTimePlan?.expiresAt) {
    return {
      tone: "success" as const,
      primary: t("unlimitedUntil", { date: formatDateTime(access.activeTimePlan.expiresAt, locale) }),
      secondary:
        access.bundleAttemptsRemaining > 0
          ? t("attemptsSaved", { count: access.bundleAttemptsRemaining })
          : undefined,
    };
  }
  if (access.bundleAttemptsRemaining > 0) {
    return {
      tone: "success" as const,
      primary: t("attemptsLeft", { count: access.bundleAttemptsRemaining }),
      secondary: access.queuedTimePlans[0]
        ? t("planStarts", { date: formatDateTime(access.queuedTimePlans[0].startsAt, locale) })
        : undefined,
    };
  }
  if (access.queuedTimePlans[0]) {
    return {
      tone: "warning" as const,
      primary: t("planStarts", { date: formatDateTime(access.queuedTimePlans[0].startsAt, locale) }),
    };
  }
  if (access.freeExamAvailable) {
    return { tone: "success" as const, primary: t("freeExam") };
  }
  return { tone: "neutral" as const, primary: t("noPlan") };
}

const PILL_TONE = {
  success: "border-success/50",
  warning: "border-warning/50",
  neutral: "border-border",
} as const;

/** Top-bar pill: the access line, linking to the pricing page (where plans are bought). */
export function AccessStatusPill({ access }: { access: AccessSummary }) {
  const t = useTranslations("AccessStatus");
  const line = useAccessLine(access);

  return (
    <Link
      href="/pricing"
      aria-label={`${t("label")}: ${line.primary}${line.secondary ? `, ${line.secondary}` : ""}`}
      className={cn(
        "flex min-w-0 flex-col justify-center rounded border bg-background py-1 pr-2.5 pl-2.5 leading-tight transition-colors hover:bg-surface-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        PILL_TONE[line.tone],
      )}
    >
      <span className="text-[11px] text-muted-foreground">{t("label")}</span>
      <span className="truncate font-mono text-xs font-medium text-foreground tabular-nums sm:text-sm">
        {line.primary}
        {line.secondary && (
          <span className="hidden font-normal text-muted-foreground md:inline"> · {line.secondary}</span>
        )}
      </span>
    </Link>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground sm:text-right">{children}</dd>
    </div>
  );
}

/** Dashboard panel: the full picture — active plan, queued plans, bundles, free exam. */
export function AccessStatusPanel({ access, canBuy }: { access: AccessSummary; canBuy: boolean }) {
  const t = useTranslations("AccessStatus");
  const locale = useLocale();
  const line = useAccessLine(access);
  const nameOf = useSubscriptionName();

  return (
    <section
      aria-labelledby="access-status-title"
      className="overflow-hidden rounded-lg border border-border bg-background"
    >
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="access-status-title" className="font-display text-xl font-medium">
              {t("title")}
            </h2>
            <p className="mt-1 font-mono text-lg font-medium text-foreground tabular-nums">{line.primary}</p>
            {line.secondary && <p className="text-sm text-muted-foreground">{line.secondary}</p>}
          </div>
          <StatusBadge tone={line.tone === "neutral" ? "neutral" : line.tone}>
            {access.hasAccess ? t("canPractice") : t("cannotPractice")}
          </StatusBadge>
        </div>

        <dl className="mt-5 flex flex-col divide-y divide-border border-t border-border">
          <DetailRow label={t("activePlan")}>
            {access.activeTimePlan?.expiresAt ? (
              <>
                <span className="font-medium">{nameOf(access.activeTimePlan)}</span>
                <span className="block font-mono text-xs text-muted-foreground">
                  {t("validUntil", { date: formatDateTime(access.activeTimePlan.expiresAt, locale) })}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailRow>
          <DetailRow label={t("queuedPlans")}>
            {access.queuedTimePlans.length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <ul className="flex flex-col gap-1">
                {access.queuedTimePlans.map((plan) => (
                  <li key={plan.id}>
                    <span className="font-medium">{nameOf(plan)}</span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {t("planStarts", { date: formatDateTime(plan.startsAt, locale) })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DetailRow>
          <DetailRow label={t("bundles")}>
            {access.bundles.length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <ul className="flex flex-col gap-1">
                {access.bundles.map((bundle, index) => (
                  <li key={bundle.id}>
                    <span className="font-medium">{nameOf(bundle)}</span>{" "}
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {t("bundleRemaining", {
                        remaining: bundle.attemptsRemaining ?? 0,
                        total: bundle.attemptLimit ?? 0,
                      })}
                      {index === 0 && access.bundles.length > 1 && ` · ${t("usedFirst")}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DetailRow>
          <DetailRow label={t("freeExamLabel")}>
            {access.freeExamAvailable ? t("freeExamAvailable") : t("freeExamUsed")}
          </DetailRow>
        </dl>
        {access.activeTimePlan && access.bundleAttemptsRemaining > 0 && (
          <p className="mt-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary-text">{t("pausedNote")}</p>
        )}
      </div>
      {canBuy && (
        <Link
          href="/pricing"
          className="group flex items-center justify-between border-t border-border bg-surface-muted/60 px-5 py-3.5 font-mono text-xs tracking-wide text-primary-text uppercase transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none sm:px-7"
        >
          {access.hasAccess ? t("buyMore") : t("seePlans")}
          <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </section>
  );
}
