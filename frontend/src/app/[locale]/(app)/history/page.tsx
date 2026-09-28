"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useApi } from "@/lib/use-api";
import { formatDateTime } from "@/lib/format";
import type { ExamAttempt } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { History as HistoryIcon } from "lucide-react";

const STATUS_VARIANT: Record<ExamAttempt["status"], "default" | "secondary" | "destructive"> = {
  IN_PROGRESS: "secondary",
  COMPLETED: "default",
  ABANDONED: "destructive",
};

export default function HistoryPage() {
  const t = useTranslations("History");
  const tStatus = useTranslations("ExamAttemptStatus");
  const locale = useLocale();
  const { data: attempts, isLoading } = useApi<ExamAttempt[]>("/exam-attempts");

  const sorted = attempts
    ? [...attempts].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
    : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardContent>
          {isLoading && <Skeleton className="h-40 w-full" />}

          {!isLoading && sorted.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <HistoryIcon className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("noAttempts")}</p>
            </div>
          )}

          {!isLoading && sorted.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("score")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell>{formatDateTime(attempt.startedAt, locale)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[attempt.status]}>
                        {tStatus(attempt.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {attempt.status === "IN_PROGRESS"
                        ? "—"
                        : `${attempt.score}/${attempt.totalQuestions}`}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        render={
                          <Link
                            href={
                              attempt.status === "IN_PROGRESS"
                                ? `/exam/${attempt.id}`
                                : `/exam/${attempt.id}/results`
                            }
                          />
                        }
                        nativeButton={false}
                      >
                        {attempt.status === "IN_PROGRESS" ? t("continue") : t("viewResults")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
