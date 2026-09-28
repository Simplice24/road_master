"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  ListChecks,
  PlayCircle,
  History,
  Wallet,
  UserRound,
  LogOut,
  Menu,
} from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_ITEMS = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/categories", labelKey: "categories", icon: ListChecks },
  { href: "/exam/start", labelKey: "startExam", icon: PlayCircle },
  { href: "/history", labelKey: "history", icon: History },
  { href: "/wallet", labelKey: "wallet", icon: Wallet },
] as const;

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
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

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

  return (
    <div className="flex min-h-screen flex-col bg-secondary/10">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2 font-heading text-lg font-semibold tracking-tight text-foreground"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              RM
            </span>
            <span className="hidden sm:inline">Road Master</span>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Button
                  key={item.href}
                  variant={active ? "secondary" : "ghost"}
                  size="sm"
                  render={<Link href={item.href} />}
                  nativeButton={false}
                >
                  <Icon data-icon="inline-start" />
                  {t(item.labelKey)}
                </Button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/wallet" className="hidden sm:block">
              <Badge variant="outline" className="h-7 gap-1.5 px-2.5 text-sm">
                <Wallet className="size-3.5" />
                {formatNumber(user.walletBalance)} RWF
              </Badge>
            </Link>
            <LanguageSwitcher className="hidden lg:inline-flex" />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
                }
              >
                <Avatar size="sm">
                  <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-1.5 py-1">
                  <p className="truncate text-sm font-medium">{user.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.phone}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/profile" />}>
                  <UserRound />
                  {t("profile")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="md:hidden"
                  render={<Link href="/dashboard" />}
                >
                  <Menu />
                  {t("menu")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  <LogOut />
                  {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border/60 px-4 py-1.5 md:hidden">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Button
                key={item.href}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className="shrink-0"
                render={<Link href={item.href} />}
                nativeButton={false}
              >
                <Icon data-icon="inline-start" />
                {t(item.labelKey)}
              </Button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
