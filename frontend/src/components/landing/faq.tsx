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
    <section id="faq" className="bg-secondary/30 py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h2>

        <Accordion className="mt-10" multiple={false}>
          {items.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger className="text-base">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
