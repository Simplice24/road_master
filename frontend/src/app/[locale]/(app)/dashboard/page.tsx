"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { ExamAttempt } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlayCircle, ListChecks, Wallet, ArrowRight } from "lucide-react";

const STATUS_VARIANT: Record<ExamAttempt["status"], "default" | "secondary" | "destructive"> = {
  IN_PROGRESS: "secondary",
  COMPLETED: "default",
  ABANDONED: "destructive",
};

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const tStatus = useTranslations("ExamAttemptStatus");
  const locale = useLocale();
  const { user } = useAuth();
  const { data: attempts, isLoading } = useApi<ExamAttempt[]>("/exam-attempts");

  const sorted = attempts
    ? [...attempts].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
    : [];
  const recent = sorted.slice(0, 5);
  const completed = sorted.filter((attempt) => attempt.status === "COMPLETED");
  const passRate =
    completed.length > 0
      ? Math.round(
          (completed.filter((attempt) => attempt.passed).length / completed.length) * 100,
        )
      : null;

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {t("welcomeBack", { name: user.fullName.split(" ")[0] })}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>{t("walletBalance")}</CardDescription>
            <CardTitle className="text-2xl">
              {formatNumber(user.walletBalance)} RWF
            </CardTitle>
          </CardHeader>
          <CardFooter className="bg-transparent pt-0">
            <Button size="sm" variant="outline" render={<Link href="/wallet" />} nativeButton={false}>
              {t("topUp")}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>{t("attemptsTaken")}</CardDescription>
            <CardTitle className="text-2xl">{sorted.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>{t("passRate")}</CardDescription>
            <CardTitle className="text-2xl">
              {passRate === null ? "—" : `${passRate}%`}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="bg-primary text-primary-foreground">
          <CardHeader>
            <CardDescription className="text-primary-foreground/80">
              {user.hasUsedFreeExam ? t("freeExamUsed") : t("freeExamAvailable")}
            </CardDescription>
            <CardTitle className="text-2xl text-primary-foreground">
              {user.hasUsedFreeExam ? "—" : "🎉"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/exam/start" className="group block">
          <Card className="transition-colors group-hover:bg-muted/50">
            <CardContent className="flex items-center gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <PlayCircle className="size-5" />
              </span>
              <div className="flex-1">
                <p className="font-medium">{t("startExam")}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/categories" className="group block">
          <Card className="transition-colors group-hover:bg-muted/50">
            <CardContent className="flex items-center gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ListChecks className="size-5" />
              </span>
              <div className="flex-1">
                <p className="font-medium">{t("browseCategories")}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t("recentAttempts")}</CardTitle>
          <Button size="sm" variant="ghost" render={<Link href="/history" />} nativeButton={false}>
            {t("viewAll")}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {isLoading && (
            <>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </>
          )}
          {!isLoading && recent.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Wallet className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("noAttemptsYet")}</p>
              <Button size="sm" render={<Link href="/exam/start" />} nativeButton={false}>
                {t("takeFirstExam")}
              </Button>
            </div>
          )}
          {recent.map((attempt) => (
            <Link
              key={attempt.id}
              href={
                attempt.status === "IN_PROGRESS"
                  ? `/exam/${attempt.id}`
                  : `/exam/${attempt.id}/results`
              }
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {formatDateTime(attempt.startedAt, locale)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {attempt.status === "IN_PROGRESS"
                    ? "—"
                    : `${attempt.score}/${attempt.totalQuestions}`}
                </span>
              </div>
              <Badge variant={STATUS_VARIANT[attempt.status]}>
                {tStatus(attempt.status)}
              </Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
