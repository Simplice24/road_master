"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
}

interface MobileNavProps {
  links: NavLink[];
  loginLabel: string;
  registerLabel: string;
  scrolled?: boolean;
}

export function MobileNav({ links, loginLabel, registerLabel, scrolled = false }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-nav-panel"
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "flex size-9 items-center justify-center rounded transition-colors",
          scrolled ? "text-foreground hover:bg-muted" : "text-white/80 hover:bg-white/10 hover:text-white",
        )}
      >
        {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {isOpen && (
        <div
          id="mobile-nav-panel"
          className="absolute inset-x-0 top-full border-t border-white/10 bg-landing-dark px-4 py-4 shadow-lg"
        >
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="rounded px-2 py-2.5 font-mono text-sm text-white/80 uppercase transition-colors hover:bg-white/10 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
            <Button
              render={<Link href="/login" onClick={() => setIsOpen(false)} />}
              nativeButton={false}
              className="landing-btn-glass h-10 w-full"
            >
              {loginLabel}
            </Button>
            <Button
              render={<Link href="/register" onClick={() => setIsOpen(false)} />}
              nativeButton={false}
              className="landing-btn-solid h-10 w-full"
            >
              {registerLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
