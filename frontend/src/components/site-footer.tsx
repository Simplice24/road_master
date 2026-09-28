import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";

export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-landing-border bg-white">
      <div className="flex flex-col items-center gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between sm:px-6 lg:px-10">
        <a
          href="https://thinkplus.rw"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium transition-colors hover:text-landing-primary"
        >
          {t("poweredBy")}
        </a>

        <p>{t("rights", { year })}</p>
      </div>
    </footer>
  );
}
