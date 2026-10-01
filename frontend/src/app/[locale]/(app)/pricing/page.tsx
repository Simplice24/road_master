"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { apiFetch, API_ERROR_CODES, ApiError } from "@/lib/api-client";
import { formatDateTime, formatRwf } from "@/lib/format";
import { localized, planFeatureLines } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan, UserSubscription } from "@/lib/api-types";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/app/page-header";
import { FULL_BLEED } from "@/components/app/settings-layout";
import { AccessStatusPill } from "@/components/app/access-status";
import { PricingCard } from "@/components/pricing-card";

const DAY_MS = 24 * 60 * 60 * 1000;

function PricingContent() {
  const t = useTranslations("PricingPage");
  const tPricing = useTranslations("Pricing");
  const locale = useLocale();
  const { user, can } = useAuth();
  const canBuy = can("subscriptions.purchaseOwn");
  const { data: plans, error, isLoading } = useApi<SubscriptionPlan[]>("/plans");
  const [buying, setBuying] = useState<SubscriptionPlan | null>(null);

  if (!user) return null;

  return (
    <div className="flex flex-col">
      <PageHeader backHref="/dashboard" title={tPricing("title")} subtitle={tPricing("subtitle")} />

      <div className="mt-8 bg-surface-muted py-8" style={FULL_BLEED}>
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <AccessStatusPill access={user.access} />
            <span className="rounded border border-border bg-background px-2.5 py-1 leading-tight">
              <span className="block text-[11px] text-muted-foreground">{t("walletBalance")}</span>
              <span className="font-mono text-sm font-medium tabular-nums">{formatRwf(user.walletBalance)}</span>
            </span>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">{t("stackingHint")}</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6 bg-background">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-80 w-full" />
            ))}
          </div>
        )}

        {!isLoading && !error && (plans ?? []).length === 0 && (
          <p className="rounded-lg border border-border bg-background px-6 py-12 text-center text-sm text-muted-foreground">
            {tPricing("empty")}
          </p>
        )}

        {!isLoading && (plans ?? []).length > 0 && (
          <div className="grid gap-6 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            {plans!.map((plan) => (
              <PricingCard
                key={plan.id}
                name={localized(plan.name, locale)}
                price={plan.price}
                currency={plan.currency}
                perLabel={tPricing("perBundle")}
                features={planFeatureLines(plan, tPricing, locale)}
                featured={plan.isMostPopular}
                featuredLabel={tPricing("mostPopular")}
                action={
                  canBuy ? (
                    <Button
                      className={cn("h-10 w-full", plan.isMostPopular ? "btn-primary" : "btn-tint")}
                      onClick={() => setBuying(plan)}
                    >
                      {t("buy")}
                    </Button>
                  ) : (
                    <p className="w-full text-center text-xs text-muted-foreground">{t("cannotBuy")}</p>
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      {buying && <PurchaseDialog plan={buying} onClose={() => setBuying(null)} />}
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono text-foreground tabular-nums">{children}</dd>
    </div>
  );
}

function PurchaseDialog({ plan, onClose }: { plan: SubscriptionPlan; onClose: () => void }) {
  const t = useTranslations("PricingPage");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const { user, token, refreshUser, can } = useAuth();
  const canTopUp = can("transactions.topUpOwn") && can("transactions.viewOwn");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) return null;
  const balance = Number(user.walletBalance);
  const insufficient = balance < plan.price;
  const name = localized(plan.name, locale);

  // Mirrors the server's stacking rule (it decides for real): a time plan starts when the
  // latest active/queued time plan ends, so no paid time is lost.
  const timePlans = [user.access.activeTimePlan, ...user.access.queuedTimePlans].filter(
    (sub): sub is NonNullable<typeof sub> => !!sub?.expiresAt,
  );
  const queuedStart =
    plan.accessType === "TIME" && timePlans.length > 0
      ? new Date(Math.max(...timePlans.map((sub) => new Date(sub.expiresAt!).getTime())))
      : null;
  const startsAt = queuedStart ?? new Date();
  const expiresAt =
    plan.accessType === "TIME" ? new Date(startsAt.getTime() + (plan.durationDays ?? 0) * DAY_MS) : null;

  async function handleConfirm() {
    if (!token) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await apiFetch<UserSubscription>("/subscriptions/purchase", {
        method: "POST",
        token,
        body: { planId: plan.id },
      });
      await refreshUser();
      toast.success(t("purchased", { name }));
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.code === API_ERROR_CODES.insufficientFunds
            ? t("insufficientFunds")
            : err.message
          : tCommon("error"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-medium">{t("confirmTitle", { name })}</DialogTitle>
          <DialogDescription>{t("confirmDescription")}</DialogDescription>
        </DialogHeader>

        <dl className="flex flex-col divide-y divide-border text-sm">
          <SummaryRow label={t("price")}>{formatRwf(plan.price)}</SummaryRow>
          <SummaryRow label={t("walletBalance")}>{formatRwf(balance)}</SummaryRow>
          <SummaryRow label={t("balanceAfter")}>
            <span className={cn(insufficient && "text-red-700 dark:text-red-300")}>
              {formatRwf(Math.max(balance - plan.price, 0))}
            </span>
          </SummaryRow>
          {plan.accessType === "TIME" ? (
            <>
              <SummaryRow label={t("startsAt")}>
                {queuedStart ? formatDateTime(queuedStart, locale) : t("immediately")}
              </SummaryRow>
              <SummaryRow label={t("expiresAt")}>{formatDateTime(expiresAt!, locale)}</SummaryRow>
            </>
          ) : (
            <SummaryRow label={t("attempts")}>{plan.attemptLimit}</SummaryRow>
          )}
        </dl>

        {queuedStart && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary-text">{t("queuedNote")}</p>}
        {plan.accessType === "ATTEMPTS" && user.access.activeTimePlan && (
          <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary-text">{t("bundlePausedNote")}</p>
        )}

        {(insufficient || error) && (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-col gap-2">
              {error ?? t("insufficientFunds")}
              {(insufficient || error === t("insufficientFunds")) && canTopUp && (
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {tCommon("cancel")}
          </Button>
          <Button className="btn-primary" onClick={handleConfirm} disabled={isSubmitting || insufficient}>
            {isSubmitting ? t("buying") : t("confirmCta", { price: formatRwf(plan.price) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PricingPage() {
  // Viewing plans needs nothing beyond being signed in (they're public); buying is gated on
  // subscriptions.purchaseOwn per card.
  return <PricingContent />;
}
