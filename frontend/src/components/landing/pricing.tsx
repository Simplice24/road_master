import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { API_BASE_URL } from "@/lib/api-client";
import { localized, planFeatureLines } from "@/lib/plans";
import type { SubscriptionPlan } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { PricingCard } from "@/components/pricing-card";
import { cn } from "@/lib/utils";

/**
 * Active plans straight from the API (no plan data lives in the frontend or i18n files).
 * `no-store` renders this per request, so an admin's plan change shows up immediately. A null
 * result means the API was unreachable — the section still renders, with a neutral message.
 */
async function fetchActivePlans(): Promise<SubscriptionPlan[] | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/plans`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as SubscriptionPlan[];
  } catch {
    return null;
  }
}

export async function Pricing() {
  const [t, locale, plans] = await Promise.all([
    getTranslations("Pricing"),
    getLocale(),
    fetchActivePlans(),
  ]);

  return (
    <section id="pricing" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("subtitle")}</p>
        </div>

        {!plans || plans.length === 0 ? (
          <p className="mx-auto mt-12 max-w-xl rounded-lg border border-landing-border px-6 py-12 text-center text-sm text-muted-foreground">
            {plans ? t("empty") : t("unavailable")}
          </p>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <PricingCard
                key={plan.id}
                name={localized(plan.name, locale)}
                price={plan.price}
                currency={plan.currency}
                perLabel={t("perBundle")}
                features={planFeatureLines(plan, t, locale)}
                featured={plan.isMostPopular}
                featuredLabel={t("mostPopular")}
                action={
                  <Button
                    render={<Link href="/register" />}
                    nativeButton={false}
                    className={cn("h-10 w-full", plan.isMostPopular ? "btn-primary" : "btn-tint")}
                  >
                    {t("cta")}
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
