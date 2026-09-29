"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AttemptQuestion, ExamAttempt } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageHeader } from "@/components/app/page-header";
import { FULL_BLEED } from "@/components/app/settings-layout";
import { StatusBadge } from "@/components/app/status-badge";
import { RequirePermission } from "@/components/app/require-permission";

type Outcome = "correct" | "wrong" | "unanswered";

const OUTCOME_ICON: Record<Outcome, ReactNode> = {
  correct: <CheckCircle2 aria-hidden className="size-[18px] text-emerald-600 dark:text-emerald-400" />,
  wrong: <XCircle aria-hidden className="size-[18px] text-red-600 dark:text-red-400" />,
  unanswered: <MinusCircle aria-hidden className="size-[18px] text-muted-foreground" />,
};

function ExamResultsContent() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = params.attemptId;
  const t = useTranslations("Results");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { token, can } = useAuth();

  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<ExamAttempt>(`/exam-attempts/${attemptId}`, { token })
      .then((data) => {
        if (data.status === "IN_PROGRESS") {
          router.replace(`/exam/${attemptId}`);
          return;
        }
        setAttempt(data);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : tCommon("error")));
  }, [attemptId, token, router, tCommon]);

  if (error) {
    return <p className="py-12 text-center text-sm text-destructive">{error}</p>;
  }

  const questions = [...(attempt?.questions ?? [])].sort((a, b) => a.order - b.order);
  const answersByQuestion = new Map((attempt?.answers ?? []).map((a) => [a.questionId, a]));
  const outcomeOf = (item: AttemptQuestion): Outcome => {
    const answer = answersByQuestion.get(item.question.id);
    if (!answer || answer.selectedOptionIds.length === 0) return "unanswered";
    return answer.isCorrect ? "correct" : "wrong";
  };
  const counts = questions.reduce(
    (sum, item) => ({ ...sum, [outcomeOf(item)]: sum[outcomeOf(item)] + 1 }),
    { correct: 0, wrong: 0, unanswered: 0 } as Record<Outcome, number>,
  );
  const minutesTaken =
    attempt?.completedAt &&
    Math.max(1, Math.round((new Date(attempt.completedAt).getTime() - new Date(attempt.startedAt).getTime()) / 60000));

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t("title")}
        subtitle={
          attempt
            ? [attempt.examConfig?.name, formatDateTime(attempt.completedAt ?? attempt.startedAt, locale)]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
      />

      <div className="mt-8 bg-surface-muted py-8" style={FULL_BLEED}>
        {!attempt ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
            {/* Answer review — one question open at a time, like the landing page FAQ. */}
            <section
              aria-labelledby="review-title"
              className="order-2 min-w-0 overflow-hidden rounded-lg border border-border bg-background lg:order-1"
            >
              <div className="flex flex-col gap-1 border-b border-border p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
                <div>
                  <h2 id="review-title" className="font-display text-xl font-medium">
                    {t("reviewTitle")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t("reviewDescription")}</p>
                </div>
                <p className="mt-2 flex gap-4 font-mono text-xs text-muted-foreground sm:mt-0">
                  <span className="flex items-center gap-1.5">
                    {OUTCOME_ICON.correct} {counts.correct}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {OUTCOME_ICON.wrong} {counts.wrong}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {OUTCOME_ICON.unanswered} {counts.unanswered}
                  </span>
                </p>
              </div>

              <Accordion multiple={false} className="px-5 sm:px-7">
                {questions.map((item) => {
                  const answer = answersByQuestion.get(item.question.id);
                  const selectedIds = new Set(answer?.selectedOptionIds ?? []);
                  const outcome = outcomeOf(item);
                  return (
                    <AccordionItem key={item.question.id} value={item.question.id} className="border-border">
                      <AccordionTrigger className="items-center gap-3 py-4 text-left text-[15px] font-medium hover:no-underline [&_[data-slot=accordion-trigger-icon]]:hidden">
                        <span className="w-7 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                          {String(item.order).padStart(2, "0")}
                        </span>
                        <span className="shrink-0">{OUTCOME_ICON[outcome]}</span>
                        <span className="sr-only">{t(`outcome.${outcome}`)}</span>
                        <span className="flex-1">{item.question.text}</span>
                        {/* Plus that turns into a minus — the landing FAQ's expand/collapse icon. */}
                        <span aria-hidden className="relative ml-auto size-4 shrink-0 text-primary-text">
                          <span className="absolute top-1/2 left-0 h-0.5 w-4 -translate-y-1/2 bg-current" />
                          <span className="absolute top-1/2 left-0 h-0.5 w-4 -translate-y-1/2 rotate-90 bg-current transition-transform duration-200 group-aria-expanded/accordion-trigger:rotate-0" />
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-5">
                        <div className="flex flex-col gap-2 pl-10 sm:pl-[3.25rem]">
                          {item.question.options.map((option) => {
                            const wasSelected = selectedIds.has(option.id);
                            return (
                              <div
                                key={option.id}
                                className={cn(
                                  "flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm",
                                  option.isCorrect
                                    ? "border-success/40 bg-success/10 text-foreground"
                                    : wasSelected
                                      ? "border-destructive/40 bg-destructive/10 text-foreground"
                                      : "border-border text-muted-foreground",
                                )}
                              >
                                <span>{option.text}</span>
                                <span className="flex shrink-0 gap-1.5">
                                  {wasSelected && (
                                    <StatusBadge tone={option.isCorrect ? "success" : "danger"}>
                                      {t("yourAnswer")}
                                    </StatusBadge>
                                  )}
                                  {option.isCorrect && !wasSelected && (
                                    <StatusBadge tone="success">{t("correctAnswer")}</StatusBadge>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                          {outcome === "unanswered" && (
                            <p className="text-xs text-muted-foreground">{t("noAnswer")}</p>
                          )}
                          {item.question.explanation && (
                            <p className="mt-1 rounded-md bg-surface-muted px-3 py-2.5 text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">{t("explanation")}: </span>
                              {item.question.explanation}
                            </p>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </section>

            {/* Score summary — first on mobile so the verdict is seen before the review. */}
            <section
              aria-labelledby="score-title"
              className="order-1 overflow-hidden rounded-lg border border-border bg-background lg:sticky lg:top-40 lg:order-2"
            >
              <div className="p-5 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="score-title" className="text-sm text-muted-foreground">
                    {t("score")}
                  </h2>
                  <StatusBadge tone={attempt.passed ? "success" : "danger"}>
                    {attempt.passed ? t("passedBadge") : t("failedBadge")}
                  </StatusBadge>
                </div>
                <p className="mt-1 font-mono text-4xl font-medium text-foreground tabular-nums">
                  {t("percentage", { percent: Number(attempt.percentage) })}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {attempt.passed ? t("passed") : t("failed")}
                </p>

                {/* Score bar with the pass mark drawn on it. */}
                <div
                  className="relative mt-5 h-2 rounded-full bg-surface-muted"
                  role="img"
                  aria-label={t("questionsCorrect", { correct: attempt.score, total: attempt.totalQuestions })}
                >
                  <div
                    className={cn("h-full rounded-full", attempt.passed ? "bg-success" : "bg-destructive")}
                    style={{ width: `${Math.min(100, Number(attempt.percentage))}%` }}
                  />
                  {attempt.examConfig && (
                    <span
                      aria-hidden
                      className="absolute -top-1 h-4 w-0.5 bg-foreground/60"
                      style={{ left: `${attempt.examConfig.passMarkPercent}%` }}
                    />
                  )}
                </div>

                <dl className="mt-5 flex flex-col divide-y divide-border border-t border-border text-sm">
                  <SummaryRow label={t("correct")} value={`${counts.correct} / ${attempt.totalQuestions}`} />
                  <SummaryRow label={t("wrong")} value={String(counts.wrong)} />
                  <SummaryRow label={t("unanswered")} value={String(counts.unanswered)} />
                  {attempt.examConfig && (
                    <SummaryRow label={t("passMark")} value={`${attempt.examConfig.passMarkPercent}%`} />
                  )}
                  {minutesTaken && <SummaryRow label={t("timeTaken")} value={t("minutes", { minutes: minutesTaken })} />}
                </dl>
              </div>
              {can("examAttempts.start") && (
                <div className="border-t border-border bg-surface-muted/60 px-5 py-4 sm:px-7">
                  <Button className="btn-primary h-11 w-full" render={<Link href="/exam/start" />} nativeButton={false}>
                    {t("tryAgain")}
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

export default function ExamResultsPage() {
  return (
    <RequirePermission anyOf={["examAttempts.viewOwn", "examAttempts.view"]}>
      <ExamResultsContent />
    </RequirePermission>
  );
}
