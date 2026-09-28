import { getTranslations } from "next-intl/server";
import { ClipboardList, ListChecks, PencilLine, UserPlus } from "lucide-react";

const stepIcons = [UserPlus, ListChecks, PencilLine, ClipboardList];

export async function HowItWorks() {
  const t = await getTranslations("HowItWorks");

  const steps = [1, 2, 3, 4].map((n) => ({
    title: t(`step${n}.title`),
    description: t(`step${n}.description`),
  }));

  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {t("title")}
      </h2>

      <ol className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = stepIcons[index];
          return (
            <li key={step.title} className="relative flex flex-col items-start gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Icon className="size-5" />
              </span>
              <span className="text-xs font-semibold tracking-wide text-gold uppercase">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="font-heading text-base font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
