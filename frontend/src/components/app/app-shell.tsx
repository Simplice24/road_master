"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LogOut, Menu, Plus, X } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { formatRwf } from "@/lib/format";
import type { Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { routing } from "@/i18n/routing";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// `anyOf`: the link shows if the user has at least one of these (empty = everyone). Must match
// the RequirePermission guard on the page itself, so a hidden link is never the only barrier.
const NAV_ITEMS: { href: string; labelKey: string; anyOf: Permission[] }[] = [
  { href: "/dashboard", labelKey: "dashboard", anyOf: [] },
  { href: "/categories", labelKey: "categories", anyOf: ["categories.view"] },
  { href: "/exam/start", labelKey: "startExam", anyOf: ["examAttempts.start"] },
  { href: "/history", labelKey: "history", anyOf: ["examAttempts.viewOwn"] },
  { href: "/wallet", labelKey: "wallet", anyOf: ["transactions.viewOwn"] },
  { href: "/users", labelKey: "users", anyOf: ["users.view"] },
  { href: "/roles", labelKey: "roles", anyOf: ["roles.view"] },
  { href: "/exam-config", labelKey: "examConfig", anyOf: ["examConfig.view"] },
];

// Top bar, tab bar and page content all span the full width with the landing page navbar's
// gutters (site-header-client), so they line up with each other and with the marketing site.
const CONTAINER = "w-full px-4 sm:px-6 lg:px-10";

function initials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("AppNav");
  const { user, isLoading, logout, can, canAny } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  // Close the mobile menu on any navigation (logo, dropdown, back button) and on Escape.
  const [menuPathname, setMenuPathname] = useState(pathname);
  if (menuPathname !== pathname) {
    setMenuPathname(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }

  function handleLogout() {
    logout();
    router.push("/login");
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const navItems = NAV_ITEMS.filter((item) => item.anyOf.length === 0 || canAny(...item.anyOf));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40">
        {/* Top bar: brand on the left, balance + account on the right. */}
        <div className="border-b border-border bg-surface-muted md:border-b-0">
          <div className={cn(CONTAINER, "flex h-16 items-center justify-between gap-3")}>
            <Link
              href="/dashboard"
              className="flex shrink-0 items-center gap-2 rounded-sm font-display text-lg font-semibold tracking-tight text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="flex size-8 items-center justify-center rounded bg-gradient-to-b from-primary to-primary-2 text-sm font-bold text-primary-foreground">
                RM
              </span>
              <span className="hidden sm:inline">Road Master</span>
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-stretch rounded border border-success/50 bg-background">
                <div className="flex flex-col justify-center py-1 pr-2 pl-2.5 leading-tight">
                  <span className="text-[11px] text-muted-foreground">{t("balance")}</span>
                  <span className="font-mono text-xs font-medium whitespace-nowrap text-foreground tabular-nums sm:text-sm">
                    {formatRwf(user.walletBalance)}
                  </span>
                </div>
                {can("transactions.topUpOwn") && can("transactions.viewOwn") && (
                  <Link
                    href="/wallet#top-up"
                    aria-label={t("topUp")}
                    className="m-1 ml-0 flex items-center gap-1.5 rounded-sm bg-primary/10 px-2.5 font-mono text-xs font-medium text-primary-text transition-colors hover:bg-primary/15 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-3"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    <span className="hidden sm:inline">{t("topUp")}</span>
                  </Link>
                )}
              </div>

              <AccountMenu
                fullName={user.fullName}
                phone={user.phone}
                roles={user.roles.map((role) => role.name)}
                onLogout={handleLogout}
              />

              <button
                type="button"
                aria-label={t("menu")}
                aria-expanded={menuOpen}
                aria-controls="app-mobile-nav"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex size-9 items-center justify-center rounded text-foreground transition-colors hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:hidden"
              >
                {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Tab bar (desktop): uppercase mono links, active one underlined in the brand color. */}
        <nav aria-label={t("mainNav")} className="hidden border-b border-border bg-background md:block">
          <ul className={cn(CONTAINER, "flex items-center gap-6 overflow-x-auto lg:gap-9")}>
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "-mb-px flex h-14 items-center border-b-2 font-mono text-sm tracking-wide whitespace-nowrap uppercase transition-colors focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                      active
                        ? "border-primary text-primary-text"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(item.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Mobile menu: same link style, active item gets the reference's tinted left-border state. */}
        {menuOpen && (
          <nav
            id="app-mobile-nav"
            aria-label={t("mainNav")}
            className="absolute inset-x-0 top-full border-y border-border bg-background shadow-lg md:hidden"
          >
            <ul className="flex flex-col py-2">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex h-12 items-center border-l-2 px-4 font-mono text-sm tracking-wide uppercase transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                        active
                          ? "border-primary bg-primary/10 text-primary-text"
                          : "border-transparent text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                      )}
                    >
                      {t(item.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>

      <main className={cn(CONTAINER, "min-w-0 flex-1 py-8")}>
        {children}
      </main>
    </div>
  );
}

// Full-width rows with hairline dividers, after the cloud.strettch.com account popover.
const MENU_ROW = "min-h-12 rounded-none px-4 text-[15px] text-foreground focus:bg-surface-muted";

function AccountMenu({
  fullName,
  phone,
  roles,
  onLogout,
}: {
  fullName: string;
  phone: string;
  roles: string[];
  onLogout: () => void;
}) {
  const t = useTranslations("AppNav");
  const tLanguage = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            aria-label={t("account")}
            className="flex items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <Avatar className="size-9 ring-2 ring-primary/15">
          <AvatarFallback className="bg-primary/10 text-primary-text">{initials(fullName)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(19rem,calc(100vw-2rem))] rounded-lg p-0 shadow-lg ring-border"
      >
        <div className="flex items-center gap-3 px-4 py-4">
          <Avatar className="size-12 shrink-0">
            <AvatarFallback className="bg-primary/10 text-base text-primary-text">{initials(fullName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-foreground">{fullName}</p>
            <p className="truncate font-mono text-sm text-muted-foreground">{phone}</p>
            {roles.length > 0 && (
              <p className="mt-1 flex flex-wrap gap-1">
                {roles.map((role) => (
                  <span
                    key={role}
                    className="rounded-sm border border-border bg-surface-muted px-1.5 py-px text-[11px] text-muted-foreground"
                  >
                    {role}
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
        <DropdownMenuSeparator className="mx-0 my-0" />

        <DropdownMenuItem className={MENU_ROW} render={<Link href="/profile" />}>
          {t("profile")}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="mx-0 my-0" />

        {/* Segmented language control in the slot the reference uses for its theme toggle.
            Radio items keep it reachable with arrow keys and announce which one is selected. */}
        <div className="flex flex-col gap-2 px-4 py-3">
          <span className="text-[15px] text-foreground">{tLanguage("label")}</span>
          <DropdownMenuRadioGroup
            value={locale}
            onValueChange={(next) => router.replace(pathname, { locale: next as string })}
            className="grid grid-cols-3 gap-1 rounded-md bg-surface-muted p-1"
          >
            {routing.locales.map((option) => (
              <DropdownMenuRadioItem
                key={option}
                value={option}
                aria-label={tLanguage(option)}
                className="justify-center rounded px-2 py-1.5 font-mono text-xs text-muted-foreground uppercase focus:bg-background focus:text-foreground data-checked:bg-background data-checked:text-foreground data-checked:shadow-sm data-checked:ring-1 data-checked:ring-border [&>[data-slot=dropdown-menu-radio-item-indicator]]:hidden"
              >
                {option}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </div>
        <DropdownMenuSeparator className="mx-0 my-0" />

        <DropdownMenuItem className={cn(MENU_ROW, "justify-between")} onClick={onLogout}>
          {t("logout")}
          <LogOut className="size-[18px] text-muted-foreground" aria-hidden />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
