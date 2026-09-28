import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export async function Hero() {
  const t = await getTranslations("Hero");

  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      {/* Soft radial glow, purely decorative */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.15),transparent_60%)]"
      />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
        <Badge className="bg-gold text-gold-foreground">{t("eyebrow")}</Badge>

        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
          {t("headline")}
        </h1>

        <p className="mt-5 max-w-xl text-base text-primary-foreground/80 sm:text-lg">
          {t("subheadline")}
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button
            size="lg"
            render={<Link href="/register" />}
            nativeButton={false}
            className="h-11 bg-gold px-6 text-base text-gold-foreground hover:bg-gold/90"
          >
            {t("ctaPrimary")}
          </Button>
          <Button
            size="lg"
            variant="outline"
            render={<Link href="/login" />}
            nativeButton={false}
            className="h-11 border-primary-foreground/30 bg-transparent px-6 text-base text-primary-foreground hover:bg-primary-foreground/10"
          >
            {t("ctaSecondary")}
          </Button>
        </div>
      </div>
    </section>
  );
}
