import { getTranslations } from "next-intl/server";
import { ClipboardList, ListChecks, PencilLine, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

const stepIcons = [UserPlus, ListChecks, PencilLine, ClipboardList];
// Purely decorative accent blocks (our own palette, no Strettch assets) echoing the faded
// color chips in the reference's compliance grid.
const accentClasses = [
  "bg-landing-primary-tint",
  "bg-amber-100",
  "bg-emerald-100",
  "bg-sky-100",
];

export async function HowItWorks() {
  const t = await getTranslations("HowItWorks");

  const steps = [1, 2, 3, 4].map((n) => ({
    title: t(`step${n}.title`),
    description: t(`step${n}.description`),
  }));

  return (
    <section id="how-it-works" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="landing-eyebrow">{t("eyebrow")}</p>
          <h2 className="mt-3 font-display text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <ol className="mx-auto mt-12 grid max-w-7xl grid-cols-1 border-y border-landing-border sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = stepIcons[index];
          return (
            <li
              key={step.title}
              className={cn(
                "relative flex flex-col gap-4 overflow-hidden border-b border-landing-border p-8",
                "lg:border-r lg:border-b-0 lg:last:border-r-0",
              )}
            >
              <div
                aria-hidden
                className={cn(
                  "absolute top-0 right-0 h-6 w-16 rounded-bl-lg opacity-70",
                  accentClasses[index],
                )}
              />
              <Icon className="size-7 text-landing-primary" />
              <span className="btn-tint w-fit rounded px-2.5 py-1 text-[11px]">
                {t("stepLabel", { number: String(index + 1).padStart(2, "0") })}
              </span>
              <h3 className="font-display text-lg font-normal text-foreground">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
