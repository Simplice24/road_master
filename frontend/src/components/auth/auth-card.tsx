"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * The form column of the auth screens (agasekestore.com-style): left-aligned heading, the form,
 * the "switch to login/register" line, and a secondary "Back to home" button. Sits directly on
 * the grey form panel from the (auth) layout — no card chrome.
 */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  const t = useTranslations("Auth");

  return (
    <div className="flex flex-col">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

      <div className="mt-7">{children}</div>

      <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>

      <Button
        variant="outline"
        className="mt-6 h-11 w-full rounded-lg border-border bg-transparent text-sm font-normal text-muted-foreground hover:bg-background hover:text-foreground"
        render={<Link href="/" />}
        nativeButton={false}
      >
        {t("backToHome")}
      </Button>
    </div>
  );
}
