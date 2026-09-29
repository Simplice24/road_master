"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function NotAuthorized() {
  const t = useTranslations("Access");

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface-muted px-6 py-20 text-center">
      <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">403</p>
      <h1 className="font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
        {t("notAuthorizedTitle")}
      </h1>
      <p className="max-w-md text-muted-foreground">{t("notAuthorizedBody")}</p>
      <Button className="btn-primary mt-2 h-10 px-5" render={<Link href="/dashboard" />} nativeButton={false}>
        {t("backToDashboard")}
      </Button>
    </div>
  );
}
