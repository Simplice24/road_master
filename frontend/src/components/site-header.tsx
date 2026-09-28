import { getTranslations } from "next-intl/server";
import { SiteHeaderClient } from "@/components/site-header-client";

export async function SiteHeader() {
  const t = await getTranslations("Nav");

  const navLinks = [
    { href: "/#how-it-works", label: t("howItWorks") },
    { href: "/#categories", label: t("categories") },
    { href: "/#pricing", label: t("pricing") },
    { href: "/#faq", label: t("faq") },
  ];

  return <SiteHeaderClient navLinks={navLinks} loginLabel={t("login")} registerLabel={t("register")} />;
}
