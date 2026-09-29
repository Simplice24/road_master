import { getTranslations } from "next-intl/server";

/** Shared by the landing page and every dashboard screen (passed into AppShell by the (app)
 * layout, since AppShell is a client component and this is a server component). */
export async function SiteFooter() {
  const t = await getTranslations("Footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-landing-border bg-white">
      <div className="flex flex-col items-center gap-1 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6 sm:text-sm lg:px-10">
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
