import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";

/**
 * Optional photo/illustration behind the brand panel (agasekestore.com-style auth layout).
 * To use your own image: put it in `frontend/public/images/` and set this to its path, e.g.
 * "/images/auth-panel.jpg". While null, the panel uses the landing page's dark grid treatment.
 */
const AUTH_PANEL_IMAGE: string | null = null;

function Logo({ className }: { className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded bg-gradient-to-b from-primary to-primary-2 font-bold text-primary-foreground ${className ?? ""}`}
    >
      RM
    </span>
  );
}

export default async function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  const t = await getTranslations("Auth");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — desktop only; on mobile it collapses to the compact header in the form panel. */}
      <aside className="relative hidden overflow-hidden bg-landing-dark text-white lg:flex">
        {AUTH_PANEL_IMAGE ? (
          <>
            <Image src={AUTH_PANEL_IMAGE} alt="" fill priority sizes="50vw" className="object-cover" />
            <div className="absolute inset-0 bg-landing-dark/75" aria-hidden />
          </>
        ) : (
          <>
            <div className="landing-grid-bg absolute inset-0" aria-hidden />
            <div
              className="absolute top-1/2 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-3xl"
              aria-hidden
            />
          </>
        )}
        <div className="relative flex w-full flex-col items-center justify-center px-12 text-center">
          <Link
            href="/"
            aria-label="Road Master"
            className="rounded focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none"
          >
            <Logo className="size-16 text-2xl shadow-lg shadow-primary/30" />
          </Link>
          <h2 className="mt-8 max-w-md font-display text-5xl leading-tight font-semibold tracking-tight">
            {t("brandTitle")}
          </h2>
          <p className="mt-5 max-w-md text-lg text-white/75">{t("brandTagline")}</p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen flex-col bg-surface-muted">
        <div className="flex items-center justify-between px-6 py-5 sm:px-10">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-sm font-display text-lg font-semibold tracking-tight text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:invisible"
          >
            <Logo className="size-8 text-sm" />
            Road Master
          </Link>
          <LanguageSwitcher />
        </div>
        <div className="flex flex-1 items-start justify-center px-6 pt-6 pb-12 sm:items-center sm:px-10 sm:pt-0">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
