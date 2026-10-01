import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PricingCardProps {
  name: string;
  price: number;
  currency: string;
  /** "one-time purchase" */
  perLabel: string;
  features: string[];
  featured: boolean;
  /** "Most popular" — shown as the ribbon when `featured`. */
  featuredLabel: string;
  /** The call to action (a link on the landing page, a buy button in the app). */
  action: ReactNode;
  /** Extra content under the features (e.g. "Starts after your current plan"). */
  note?: ReactNode;
  className?: string;
}

/**
 * One pricing plan, exactly as candidates see it. Shared by the landing page (server
 * component), the in-app pricing page and the admin plan form's live preview, so the preview
 * can't drift from the real thing. Hook-free on purpose so it renders on the server too.
 */
export function PricingCard({
  name,
  price,
  currency,
  perLabel,
  features,
  featured,
  featuredLabel,
  action,
  note,
  className,
}: PricingCardProps) {
  return (
    <Card
      className={cn(
        "relative flex h-full flex-col overflow-visible rounded-lg border border-landing-border bg-background p-6 shadow-none ring-0",
        featured && "border-landing-primary shadow-lg shadow-landing-primary/10",
        className,
      )}
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-gradient-to-b from-landing-primary to-landing-primary-2 px-4 py-1.5 font-mono text-[11px] font-medium whitespace-nowrap text-white uppercase">
          {featuredLabel}
        </span>
      )}

      <CardContent className="flex-1 px-0">
        <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{name}</p>
        <p className="mt-2 font-display text-3xl font-medium text-foreground">
          {formatNumber(price)} <span className="text-base font-normal text-muted-foreground">{currency}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{perLabel}</p>

        <ul className="mt-6 flex flex-col gap-3">
          {features.map((feature, index) => (
            <li key={`${index}-${feature}`} className="flex items-start gap-2.5 text-sm text-foreground">
              <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-landing-primary-tint text-landing-primary">
                <Check className="size-3" aria-hidden />
              </span>
              {feature}
            </li>
          ))}
        </ul>
        {note && <div className="mt-5">{note}</div>}
      </CardContent>

      <CardFooter className="border-t-0 bg-transparent p-0">{action}</CardFooter>
    </Card>
  );
}
