import { getTranslations } from "next-intl/server";
import { BookOpenCheck, LayoutGrid, Timer } from "lucide-react";

export async function TrustStrip() {
  const t = await getTranslations("TrustStrip");

  const items = [
    { icon: BookOpenCheck, label: t("questions") },
    { icon: LayoutGrid, label: t("categories") },
    { icon: Timer, label: t("timed") },
  ];

  return (
    <section className="border-b border-border/60 bg-secondary/40">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6 lg:px-8">
        {items.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center justify-center gap-3 sm:justify-start">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-4.5" />
            </span>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
