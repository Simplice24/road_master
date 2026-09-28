import { getTranslations } from "next-intl/server";
import { Gift, Wallet } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Mirrors the platform's live "Provisional Practice Exam" ExamConfig. If pricing/duration ever
// changes on the backend, update these three numbers to match — kept as plain constants here
// rather than a live fetch since /exam-config requires authentication (see design notes).
const EXAM_CONFIG = {
  price: "100 RWF",
  numberOfQuestions: 20,
  durationMinutes: 20,
  passMarkPercent: 60,
};

export async function Pricing() {
  const t = await getTranslations("Pricing");

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {t("title")}
      </h2>

      <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
        <Card className="ring-border/80">
          <CardHeader>
            <span className="flex size-10 items-center justify-center rounded-lg bg-success/10 text-success">
              <Gift className="size-5" />
            </span>
            <CardTitle className="mt-3 text-lg">{t("freeTitle")}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {t("freeDescription")}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="ring-2 ring-gold/50">
          <CardHeader>
            <span className="flex size-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
              <Wallet className="size-5" />
            </span>
            <CardTitle className="mt-3 text-lg">{t("paidTitle")}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {t("paidDescription", {
                price: EXAM_CONFIG.price,
                questions: EXAM_CONFIG.numberOfQuestions,
                minutes: EXAM_CONFIG.durationMinutes,
                passMark: EXAM_CONFIG.passMarkPercent,
              })}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </section>
  );
}
