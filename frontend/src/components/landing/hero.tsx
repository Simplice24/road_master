import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export async function Hero() {
  const t = await getTranslations("Hero");

  return (
    <section className="relative overflow-hidden bg-landing-dark text-white">
      {/* Decorative square-dot texture + soft glow behind the headline */}
      <div aria-hidden className="landing-dots-bg pointer-events-none absolute inset-0 opacity-60" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(107,99,255,0.25),transparent_60%)]"
      />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 pt-40 pb-24 text-center sm:px-6 sm:pt-48 sm:pb-32 lg:px-8">
        <h1 className="mt-6 font-display text-[40px] leading-[1.04] font-normal tracking-[-0.02em] text-white sm:text-[48px] md:text-[56px]">
          {t("headline")}
        </h1>

        <p className="mt-5 max-w-xl text-base text-white/70 sm:text-lg">
          {t("subheadline")}
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button
            size="lg"
            render={<Link href="/register" />}
            nativeButton={false}
            className="btn-primary h-11 px-6 text-base"
          >
            {t("ctaPrimary")}
          </Button>
        </div>
      </div>
    </section>
  );
}
