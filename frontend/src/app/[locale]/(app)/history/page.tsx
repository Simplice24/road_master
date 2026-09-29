"use client";

import { useTranslations } from "next-intl";
import { useApi } from "@/lib/use-api";
import type { ExamAttempt } from "@/lib/api-types";
import { PageHeader } from "@/components/app/page-header";
import { AttemptsTable } from "@/components/app/attempts-table";
import { RequirePermission } from "@/components/app/require-permission";

function HistoryContent() {
  const t = useTranslations("History");
  const { data: attempts, isLoading } = useApi<ExamAttempt[]>("/exam-attempts");

  const sorted = attempts
    ? [...attempts].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
    : [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <AttemptsTable
        attempts={sorted}
        isLoading={isLoading}
        caption={t("title")}
        emptyMessage={t("noAttempts")}
      />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <RequirePermission anyOf={["examAttempts.viewOwn"]}>
      <HistoryContent />
    </RequirePermission>
  );
}
