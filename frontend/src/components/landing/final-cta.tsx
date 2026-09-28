import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export async function FinalCta() {
  const t = await getTranslations("FinalCta");

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="relative flex flex-col items-center overflow-hidden rounded-lg bg-landing-dark px-6 py-14 text-center text-white sm:px-12">
        <div aria-hidden className="landing-grid-bg pointer-events-none absolute inset-0 opacity-50" />
        <h2 className="relative font-display text-2xl font-normal tracking-tight sm:text-3xl">
          {t("title")}
        </h2>
        <p className="relative mt-3 max-w-md text-white/70">{t("subtitle")}</p>
        <Button
          size="lg"
          render={<Link href="/register" />}
          nativeButton={false}
          className="btn-primary relative mt-8 h-11 px-8 text-base"
        >
          {t("cta")}
        </Button>
      </div>
    </section>
  );
}
