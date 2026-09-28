import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const t = await getTranslations("Nav");

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight text-foreground"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            RM
          </span>
          Road Master
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <Link href="/#how-it-works" className="transition-colors hover:text-foreground">
            {t("howItWorks")}
          </Link>
          <Link href="/#categories" className="transition-colors hover:text-foreground">
            {t("categories")}
          </Link>
          <Link href="/#pricing" className="transition-colors hover:text-foreground">
            {t("pricing")}
          </Link>
          <Link href="/#faq" className="transition-colors hover:text-foreground">
            {t("faq")}
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/login" />}
            nativeButton={false}
            className="hidden sm:inline-flex"
          >
            {t("login")}
          </Button>
          <Button
            size="sm"
            render={<Link href="/register" />}
            nativeButton={false}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            {t("register")}
          </Button>
        </div>
      </div>
    </header>
  );
}
