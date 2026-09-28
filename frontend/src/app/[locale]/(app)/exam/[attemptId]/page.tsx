"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { ExamAttempt } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckIcon, Loader2, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function ExamTakingPage() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = params.attemptId;
  const t = useTranslations("Exam");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const { token } = useAuth();

  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [savedQuestionIds, setSavedQuestionIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  const hasAutoFinished = useRef(false);

  const loadAttempt = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<ExamAttempt>(`/exam-attempts/${attemptId}`, { token });
      setAttempt(data);
      const initialAnswers: Record<string, string[]> = {};
      const saved = new Set<string>();
      for (const answer of data.answers ?? []) {
        initialAnswers[answer.questionId] = answer.selectedOptionIds;
        saved.add(answer.questionId);
      }
      setAnswers(initialAnswers);
      setSavedQuestionIds(saved);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : tCommon("error"));
    }
  }, [attemptId, token, tCommon]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAttempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, token]);

  const questions = useMemo(
    () => [...(attempt?.questions ?? [])].sort((a, b) => a.order - b.order),
    [attempt],
  );
  const totalQuestions = questions.length;
  const current = questions[currentIndex];

  const finishAttempt = useCallback(async () => {
    if (!token) return;
    setIsFinishing(true);
    try {
      await apiFetch(`/exam-attempts/${attemptId}/complete`, {
        method: "POST",
        token,
      });
      router.replace(`/exam/${attemptId}/results`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon("error"));
      setIsFinishing(false);
    }
  }, [attemptId, token, router, tCommon]);

  useEffect(() => {
    if (!attempt?.examConfig) return;
    if (attempt.status !== "IN_PROGRESS") {
      router.replace(`/exam/${attemptId}/results`);
      return;
    }
    const deadline =
      new Date(attempt.startedAt).getTime() + attempt.examConfig.durationMinutes * 60_000;

    const tick = () => {
      const remaining = deadline - Date.now();
      setTimeLeftMs(remaining);
      if (remaining <= 0 && !hasAutoFinished.current) {
        hasAutoFinished.current = true;
        toast.info(t("timeUp"));
        finishAttempt();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [attempt, attemptId, router, t, finishAttempt]);

  async function saveAnswer(questionId: string, optionIds: string[]) {
    if (!token || optionIds.length === 0) return;
    setSavingQuestionId(questionId);
    try {
      await apiFetch(`/exam-attempts/${attemptId}/answers`, {
        method: "POST",
        token,
        body: { questionId, optionIds },
      });
      setSavedQuestionIds((prev) => new Set(prev).add(questionId));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setSavingQuestionId(null);
    }
  }

  function handleSingleSelect(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: [optionId] }));
    setSavedQuestionIds((prev) => {
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
    void saveAnswer(questionId, [optionId]);
  }

  function handleMultiToggle(questionId: string, optionId: string, checked: boolean) {
    setAnswers((prev) => {
      const existing = prev[questionId] ?? [];
      const next = checked
        ? [...existing, optionId]
        : existing.filter((id) => id !== optionId);
      setSavedQuestionIds((savedPrev) => {
        const nextSaved = new Set(savedPrev);
        nextSaved.delete(questionId);
        return nextSaved;
      });
      void saveAnswer(questionId, next);
      return { ...prev, [questionId]: next };
    });
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center text-sm text-destructive">
        {loadError}
      </div>
    );
  }

  if (!attempt || !current) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const answeredCount = Object.values(answers).filter((options) => options.length > 0).length;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const selected = answers[current.question.id] ?? [];
  const isSaving = savingQuestionId === current.question.id;
  const isSaved = savedQuestionIds.has(current.question.id);
  const isLowOnTime = timeLeftMs !== null && timeLeftMs < 60_000;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {t("question", { current: currentIndex + 1, total: totalQuestions })}
        </p>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-medium tabular-nums",
            isLowOnTime
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-muted/50 text-foreground",
          )}
        >
          <Clock className="size-3.5" />
          {timeLeftMs !== null ? formatDuration(timeLeftMs) : "--:--"}
        </div>
      </div>

      <Progress value={((currentIndex + 1) / totalQuestions) * 100} />

      <Card>
        <CardHeader>
          <p className="text-base font-medium">{current.question.text}</p>
          {current.question.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.question.imageUrl}
              alt=""
              className="mt-2 max-h-64 w-full rounded-lg object-contain"
            />
          )}
          <p className="text-xs text-muted-foreground">
            {current.question.allowMultiple ? t("selectMultiple") : t("selectOne")}
          </p>
        </CardHeader>
        <CardContent>
          {current.question.allowMultiple ? (
            <div className="flex flex-col gap-2">
              {current.question.options.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 p-3 has-data-checked:border-primary has-data-checked:bg-primary/5"
                >
                  <Checkbox
                    checked={selected.includes(option.id)}
                    onCheckedChange={(checked) =>
                      handleMultiToggle(current.question.id, option.id, checked === true)
                    }
                  />
                  <span className="text-sm">{option.text}</span>
                </label>
              ))}
            </div>
          ) : (
            <RadioGroup
              value={selected[0] ?? ""}
              onValueChange={(value) => handleSingleSelect(current.question.id, value)}
            >
              {current.question.options.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 p-3 has-data-checked:border-primary has-data-checked:bg-primary/5"
                >
                  <RadioGroupItem value={option.id} />
                  <span className="text-sm">{option.text}</span>
                </label>
              ))}
            </RadioGroup>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-1.5 bg-transparent pt-0 text-xs text-muted-foreground">
          {isSaving && (
            <>
              <Loader2 className="size-3.5 animate-spin" /> {tCommon("saving")}
            </>
          )}
          {!isSaving && isSaved && (
            <>
              <CheckIcon className="size-3.5 text-success" /> {tCommon("saved")}
            </>
          )}
        </CardFooter>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
        >
          <ChevronLeft data-icon="inline-start" />
          {t("previous")}
        </Button>

        {isLastQuestion ? (
          <Button
            className="bg-gold text-gold-foreground hover:bg-gold/90"
            onClick={() => setConfirmOpen(true)}
          >
            {t("finish")}
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentIndex((index) => Math.min(totalQuestions - 1, index + 1))}
          >
            {t("next")}
            <ChevronRight data-icon="inline-end" />
          </Button>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmFinishTitle")}</DialogTitle>
            <DialogDescription>
              {t("confirmFinishDescription", {
                answered: answeredCount,
                total: totalQuestions,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              className="bg-gold text-gold-foreground hover:bg-gold/90"
              disabled={isFinishing}
              onClick={finishAttempt}
            >
              {isFinishing ? t("finishing") : t("confirmFinishCta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
