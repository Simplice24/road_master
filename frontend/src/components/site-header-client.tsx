"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MobileNav } from "@/components/mobile-nav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
}

interface SiteHeaderClientProps {
  navLinks: NavLink[];
  loginLabel: string;
  registerLabel: string;
}

export function SiteHeaderClient({ navLinks, loginLabel, registerLabel }: SiteHeaderClientProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        scrolled ? "border-border bg-white/95 shadow-sm backdrop-blur-sm" : "border-white/10 bg-landing-dark",
      )}
    >
      <div className="relative flex h-16 items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 font-display text-lg font-semibold tracking-tight transition-colors",
            scrolled ? "text-foreground" : "text-white",
          )}
        >
          <span className="flex size-8 items-center justify-center rounded bg-landing-primary text-sm font-bold text-white">
            RM
          </span>
          Road Master
        </Link>

        <nav className="hidden items-center gap-8 font-mono text-xs tracking-wide uppercase md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "transition-colors",
                scrolled ? "text-muted-foreground hover:text-foreground" : "text-white/70 hover:text-white",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher
            className={cn("hidden sm:inline-flex", !scrolled && "border-white/15 bg-white/10 text-white")}
          />
          <Button
            render={<Link href="/login" />}
            nativeButton={false}
            className={cn("hidden h-9 px-4 sm:inline-flex", scrolled ? "btn-tint" : "landing-btn-glass")}
          >
            {loginLabel}
          </Button>
          <Button
            render={<Link href="/register" />}
            nativeButton={false}
            className={cn("h-9 px-4", scrolled ? "btn-primary" : "landing-btn-solid")}
          >
            {registerLabel}
          </Button>

          <MobileNav links={navLinks} loginLabel={loginLabel} registerLabel={registerLabel} scrolled={scrolled} />
        </div>
      </div>
    </header>
  );
}
