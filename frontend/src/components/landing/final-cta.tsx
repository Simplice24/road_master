import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export async function FinalCta() {
  const t = await getTranslations("FinalCta");

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="flex flex-col items-center rounded-2xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("title")}
        </h2>
        <p className="mt-3 max-w-md text-primary-foreground/80">{t("subtitle")}</p>
        <Button
          size="lg"
          render={<Link href="/register" />}
          nativeButton={false}
          className="mt-8 h-11 bg-gold px-8 text-base text-gold-foreground hover:bg-gold/90"
        >
          {t("cta")}
        </Button>
      </div>
    </section>
  );
}
