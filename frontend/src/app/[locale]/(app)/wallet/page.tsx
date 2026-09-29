"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDateTime, formatRwf } from "@/lib/format";
import type { Transaction } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { TransactionStatusBadge } from "@/components/app/record-status";
import { RequirePermission } from "@/components/app/require-permission";

const PROVIDERS = ["MTN_MOMO", "AIRTEL_MONEY", "CARD"] as const;

function WalletContent() {
  const t = useTranslations("Wallet");
  const tType = useTranslations("TransactionType");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const { user, token, refreshUser, can } = useAuth();
  const canTopUp = can("transactions.topUpOwn");
  const { data: transactions, isLoading, refetch } = useApi<Transaction[]>("/transactions");

  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState<string>(PROVIDERS[0]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleTopUp(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await apiFetch("/transactions/topup", {
        method: "POST",
        token,
        body: { amount: Number(amount), provider },
      });
      await Promise.all([refreshUser(), refetch()]);
      setAmount("");
      toast.success(t("topUpSuccess"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const sorted = transactions
    ? [...transactions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    : [];

  const columns: DataTableColumn<Transaction>[] = [
    {
      key: "type",
      header: t("type"),
      cell: (transaction) => tType(transaction.type),
    },
    {
      key: "amount",
      header: t("amount"),
      align: "right",
      className: "font-mono tabular-nums",
      cell: (transaction) =>
        `${transaction.type === "TOPUP" || transaction.type === "REFUND" ? "+" : "-"}${formatRwf(transaction.amount)}`,
    },
    {
      key: "status",
      header: t("status"),
      cell: (transaction) => <TransactionStatusBadge status={transaction.status} />,
    },
    {
      key: "date",
      header: t("date"),
      className: "text-muted-foreground",
      cell: (transaction) => formatDateTime(transaction.createdAt, locale),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className={canTopUp ? "grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" : "grid gap-4"}>
        <div className="flex flex-col justify-center rounded-lg border border-border bg-surface-muted p-5">
          <p className="text-sm text-muted-foreground">{t("currentBalance")}</p>
          <p className="mt-1 font-mono text-2xl font-medium text-foreground tabular-nums">
            {formatRwf(user?.walletBalance ?? 0)}
          </p>
        </div>

        {canTopUp && (
          <section
            id="top-up"
            aria-labelledby="top-up-title"
            className="scroll-mt-40 rounded-lg border border-border bg-background"
          >
            <h2 id="top-up-title" className="border-b border-border px-5 py-4 font-display text-lg font-medium">
              {t("topUpTitle")}
            </h2>
            <form onSubmit={handleTopUp} className="flex flex-col gap-4 p-5">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="amount">{t("amount")}</Label>
                  <Input
                    id="amount"
                    type="number"
                    min={1}
                    step="1"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder={t("amountPlaceholder")}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="provider">{t("provider")}</Label>
                  <Select
                    value={provider}
                    onValueChange={(value) => setProvider(value ?? PROVIDERS[0])}
                    items={PROVIDERS.map((option) => ({
                      value: option,
                      label: option.replace("_", " "),
                    }))}
                  >
                    <SelectTrigger id="provider" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="submit"
                className="btn-primary h-10 w-full sm:w-auto sm:self-end sm:px-5"
                disabled={isSubmitting}
              >
                {isSubmitting ? t("toppingUp") : t("topUpCta")}
              </Button>
            </form>
          </section>
        )}
      </div>

      <section aria-labelledby="transactions-title" className="flex flex-col gap-4">
        <h2 id="transactions-title" className="font-display text-xl font-medium">
          {t("transactionHistory")}
        </h2>
        <DataTable
          columns={columns}
          rows={sorted}
          getRowKey={(transaction) => transaction.id}
          isLoading={isLoading}
          caption={t("transactionHistory")}
          emptyMessage={t("noTransactions")}
        />
      </section>
    </div>
  );
}

export default function WalletPage() {
  return (
    <RequirePermission anyOf={["transactions.viewOwn"]}>
      <WalletContent />
    </RequirePermission>
  );
}
