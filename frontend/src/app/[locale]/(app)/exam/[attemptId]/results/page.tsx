"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { ExamAttempt } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle2, XCircle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ExamResultsPage() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = params.attemptId;
  const t = useTranslations("Results");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const { token } = useAuth();

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

  if (!attempt) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const questions = [...(attempt.questions ?? [])].sort((a, b) => a.order - b.order);
  const answersByQuestion = new Map((attempt.answers ?? []).map((a) => [a.questionId, a]));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Card
        className={cn(
          "border-0",
          attempt.passed ? "bg-success/10" : "bg-destructive/10",
        )}
      >
        <CardHeader className="items-center text-center">
          <span
            className={cn(
              "mb-2 flex size-14 items-center justify-center rounded-full",
              attempt.passed ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive",
            )}
          >
            {attempt.passed ? <Trophy className="size-7" /> : <XCircle className="size-7" />}
          </span>
          <CardTitle className="text-xl">
            {attempt.passed ? t("passed") : t("failed")}
          </CardTitle>
          <CardDescription className="text-base">
            {t("questionsCorrect", { correct: attempt.score, total: attempt.totalQuestions })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-2">
          <p className="text-3xl font-semibold tabular-nums">
            {t("percentage", { percent: Number(attempt.percentage) })}
          </p>
          <Progress
            value={Number(attempt.percentage)}
            className="w-full max-w-xs"
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button render={<Link href="/dashboard" />} nativeButton={false} variant="outline">
          {t("backToDashboard")}
        </Button>
        <Button render={<Link href="/exam/start" />} nativeButton={false} className="btn-primary">
          {t("tryAgain")}
        </Button>
        <Button render={<Link href="/history" />} nativeButton={false} variant="ghost">
          {t("viewHistory")}
        </Button>
      </div>

      <div>
        <h2 className="mb-2 font-heading text-lg font-semibold">{t("reviewTitle")}</h2>
        <Accordion>
          {questions.map((item) => {
            const answer = answersByQuestion.get(item.question.id);
            const selectedIds = new Set(answer?.selectedOptionIds ?? []);
            const isCorrect = answer?.isCorrect ?? false;

            return (
              <AccordionItem key={item.question.id} value={item.question.id}>
                <AccordionTrigger>
                  <span className="flex items-start gap-2 pr-2">
                    {isCorrect ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                    ) : (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    )}
                    <span>
                      {item.order}. {item.question.text}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-1.5 pl-6">
                    {item.question.options.map((option) => {
                      const wasSelected = selectedIds.has(option.id);
                      return (
                        <div
                          key={option.id}
                          className={cn(
                            "rounded-md border px-2.5 py-1.5 text-sm",
                            option.isCorrect &&
                              "border-success/40 bg-success/10 text-success-foreground",
                            wasSelected &&
                              !option.isCorrect &&
                              "border-destructive/40 bg-destructive/10",
                            !option.isCorrect && !wasSelected && "border-border/60",
                          )}
                        >
                          {option.text}
                          {wasSelected && (
                            <Badge variant="outline" className="ml-2">
                              {t("yourAnswer")}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                    {selectedIds.size === 0 && (
                      <p className="text-xs text-muted-foreground">{t("noAnswer")}</p>
                    )}
                    {item.question.explanation && (
                      <p className="mt-1 text-sm text-muted-foreground">
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
      </div>
    </div>
  );
}
