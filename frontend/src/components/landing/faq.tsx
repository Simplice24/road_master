import { getTranslations } from "next-intl/server";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export async function Faq() {
  const t = await getTranslations("Faq");

  const items = [1, 2, 3, 4].map((n) => ({
    id: `q${n}`,
    question: t(`q${n}.question`),
    answer: t(`q${n}.answer`),
  }));

  return (
    <section id="faq" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("subtitle")}</p>
        </div>

        <Accordion className="mt-10" multiple={false}>
          {items.map((item) => (
            <AccordionItem key={item.id} value={item.id} className="border-landing-divider">
              <AccordionTrigger className="py-4 text-base font-medium [&_[data-slot=accordion-trigger-icon]]:hidden">
                {item.question}
                <span
                  aria-hidden
                  className="relative ml-auto size-4 shrink-0 text-landing-primary"
                >
                  <span className="absolute top-1/2 left-0 h-0.5 w-4 -translate-y-1/2 bg-current" />
                  <span className="absolute top-1/2 left-0 h-0.5 w-4 -translate-y-1/2 bg-current transition-transform duration-200 group-aria-expanded/accordion-trigger:rotate-0 rotate-90" />
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
