import { AppShell } from "@/components/app/app-shell";

export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return <AppShell>{children}</AppShell>;
}
