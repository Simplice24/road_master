"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Info, Play } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { ExamAttempt } from "@/lib/api-types";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { AttemptStatusBadge } from "@/components/app/record-status";
import { RowActionsMenu } from "@/components/app/row-actions-menu";

interface AttemptsTableProps {
  attempts: ExamAttempt[];
  isLoading: boolean;
  caption: string;
  emptyMessage: ReactNode;
}

/** Exam attempts table shared by the dashboard (recent attempts) and the history page. */
export function AttemptsTable({ attempts, isLoading, caption, emptyMessage }: AttemptsTableProps) {
  const t = useTranslations("History");
  const locale = useLocale();

  const columns: DataTableColumn<ExamAttempt>[] = [
    {
      key: "date",
      header: t("date"),
      cell: (attempt) => formatDateTime(attempt.startedAt, locale),
    },
    {
      key: "status",
      header: t("status"),
      cell: (attempt) => <AttemptStatusBadge attempt={attempt} />,
    },
    {
      key: "score",
      header: t("score"),
      className: "font-mono tabular-nums text-muted-foreground",
      cell: (attempt) =>
        attempt.status === "IN_PROGRESS" ? "—" : `${attempt.score}/${attempt.totalQuestions}`,
    },
    {
      key: "actions",
      header: t("actions"),
      srOnlyHeader: true,
      align: "center",
      className: "w-16",
      cell: (attempt) => {
        const inProgress = attempt.status === "IN_PROGRESS";
        return (
          <RowActionsMenu
            rowLabel={formatDateTime(attempt.startedAt, locale)}
            actions={[
              inProgress
                ? { key: "continue", label: t("continue"), icon: Play, href: `/exam/${attempt.id}` }
                : {
                    key: "results",
                    label: t("viewResults"),
                    icon: Info,
                    href: `/exam/${attempt.id}/results`,
                  },
            ]}
          />
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={attempts}
      getRowKey={(attempt) => attempt.id}
      isLoading={isLoading}
      caption={caption}
      emptyMessage={emptyMessage}
    />
  );
}
