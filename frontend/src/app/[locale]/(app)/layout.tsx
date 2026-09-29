import { AppShell } from "@/components/app/app-shell";
import { SiteFooter } from "@/components/site-footer";

export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return <AppShell footer={<SiteFooter />}>{children}</AppShell>;
}
