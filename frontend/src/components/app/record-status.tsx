"use client";

import { useTranslations } from "next-intl";
import type { ExamAttempt, Transaction } from "@/lib/api-types";
import { StatusBadge, type StatusTone } from "@/components/app/status-badge";

export function AttemptStatusBadge({ attempt }: { attempt: ExamAttempt }) {
  const t = useTranslations("ExamAttemptStatus");

  if (attempt.status === "COMPLETED") {
    return attempt.passed ? (
      <StatusBadge tone="success">{t("passed")}</StatusBadge>
    ) : (
      <StatusBadge tone="danger">{t("failed")}</StatusBadge>
    );
  }
  if (attempt.status === "IN_PROGRESS") {
    return <StatusBadge tone="warning">{t("IN_PROGRESS")}</StatusBadge>;
  }
  return <StatusBadge tone="neutral">{t("ABANDONED")}</StatusBadge>;
}

const TRANSACTION_TONE: Record<Transaction["status"], StatusTone> = {
  SUCCESS: "success",
  PENDING: "warning",
  FAILED: "danger",
};

export function TransactionStatusBadge({ status }: { status: Transaction["status"] }) {
  const t = useTranslations("TransactionStatus");
  return <StatusBadge tone={TRANSACTION_TONE[status]}>{t(status)}</StatusBadge>;
}
