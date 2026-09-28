import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PLAN_KEYS = ["plan1", "plan2", "plan3", "plan4"] as const;
const FEATURED_PLAN = "plan3";

export async function Pricing() {
  const t = await getTranslations("Pricing");

  const plans = PLAN_KEYS.map((key) => ({
    key,
    price: t.raw(`${key}.price`) as number,
    features: t.raw(`${key}.features`) as string[],
    featured: key === FEATURED_PLAN,
  }));

  return (
    <section id="pricing" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card
              key={plan.key}
              className={cn(
                "relative flex h-full flex-col overflow-visible rounded-lg border border-landing-border p-6 shadow-none ring-0",
                plan.featured && "border-landing-primary shadow-lg shadow-landing-primary/10",
              )}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-gradient-to-b from-landing-primary to-landing-primary-2 px-4 py-1.5 font-mono text-[11px] font-medium whitespace-nowrap text-white uppercase">
                  {t("mostPopular")}
                </span>
              )}

              <CardContent className="flex-1 px-0">
                <p className="font-display text-3xl font-medium text-foreground">
                  {formatNumber(plan.price)} <span className="text-base font-normal text-muted-foreground">RWF</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t("perBundle")}</p>

                <ul className="mt-6 flex flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
                      <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-landing-primary-tint text-landing-primary">
                        <Check className="size-3" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="border-t-0 bg-transparent p-0">
                <Button
                  render={<Link href="/register" />}
                  nativeButton={false}
                  className={cn(
                    "h-10 w-full",
                    plan.featured ? "btn-primary" : "btn-tint",
                  )}
                >
                  {t("cta")}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
