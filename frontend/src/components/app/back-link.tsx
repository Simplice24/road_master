"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

/** "← Back" above a page title, after the cloud.strettch.com Account Settings page. Uses a fixed
 * parent route rather than browser history, so it behaves the same after a reload or deep link. */
export function BackLink({ href = "/dashboard", label }: { href?: string; label?: string }) {
  const t = useTranslations("Common");
  return (
    <Link
      href={href}
      className="flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {label ?? t("back")}
    </Link>
  );
}
