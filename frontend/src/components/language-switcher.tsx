"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { LanguageFlag } from "@/components/language-flag";

interface LanguageSwitcherProps {
  className?: string;
  /** "dark" for use on the landing hero's dark header (before it turns white on scroll). */
  tone?: "light" | "dark";
}

/**
 * Segmented language control in the app's design language — small radius (not a pill), a flag
 * per language, a raised pill for the active one. 36px tall (h-9) to line up with the landing
 * header's Log in / Get started buttons. Each option's accessible name and tooltip is the full
 * language name, so the flags never have to carry meaning alone.
 */
export function LanguageSwitcher({ className, tone = "light" }: LanguageSwitcherProps) {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const dark = tone === "dark";

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn(
        "inline-flex h-9 items-stretch gap-0.5 rounded-md border p-0.5",
        dark ? "border-white/15 bg-white/10" : "border-border bg-surface-muted",
        className,
      )}
    >
      {routing.locales.map((nextLocale) => {
        const active = nextLocale === locale;
        return (
          <button
            key={nextLocale}
            type="button"
            aria-pressed={active}
            aria-label={t(nextLocale)}
            title={t(nextLocale)}
            onClick={() => router.replace(pathname, { locale: nextLocale })}
            className={cn(
              "flex items-center justify-center rounded px-2.5 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : dark
                  ? "opacity-70 hover:bg-white/10 hover:opacity-100"
                  : "opacity-70 hover:bg-background/60 hover:opacity-100",
            )}
          >
            <LanguageFlag locale={nextLocale} />
          </button>
        );
      })}
    </div>
  );
}
