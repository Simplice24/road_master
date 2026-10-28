import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";

function Logo({ className }: { className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded bg-gradient-to-b from-primary to-primary-2 font-bold text-primary-foreground ${className ?? ""}`}
    >
      RM
    </span>
  );
}

export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel: desktop only; on mobile it collapses to the compact header in the form panel.
          Sticky at viewport height so the road signs stay in view while a long form scrolls. */}
      <aside className="sticky top-0 hidden h-screen self-start bg-surface-muted p-4 lg:flex">
        <AuthBrandPanel />
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
