"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-secondary/50 p-0.5 text-xs font-medium",
        className,
      )}
    >
      {routing.locales.map((nextLocale) => (
        <button
          key={nextLocale}
          type="button"
          aria-current={nextLocale === locale}
          onClick={() => router.replace(pathname, { locale: nextLocale })}
          className={cn(
            "rounded-full px-2.5 py-1 uppercase transition-colors",
            nextLocale === locale
              ? "bg-background text-foreground shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {nextLocale}
        </button>
      ))}
    </div>
  );
}
