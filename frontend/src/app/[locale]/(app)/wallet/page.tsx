"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime, formatNumber, formatRwf } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/api-types";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PageHeader } from "@/components/app/page-header";
import { FULL_BLEED, SettingsField, SettingsSection } from "@/components/app/settings-layout";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { TransactionStatusBadge } from "@/components/app/record-status";
import { RequirePermission } from "@/components/app/require-permission";

const PROVIDERS = ["MTN_MOMO", "AIRTEL_MONEY", "CARD"] as const;
const PROVIDER_OPTIONS = PROVIDERS.map((option) => ({ value: option, label: option.replace("_", " ") }));
const QUICK_AMOUNTS = [1000, 5000, 10000, 20000];
// Whole RWF, below the wallet column's Decimal(10, 2) ceiling. The API only requires > 0.
const TOP_UP_LIMITS = { min: 1, max: 99_999_999 } as const;

function BalanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

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

  const amountValue = Number(amount);
  const amountError =
    amount.trim() === ""
      ? undefined // untouched: no message, the button just stays disabled
      : !Number.isInteger(amountValue) || amountValue < TOP_UP_LIMITS.min || amountValue > TOP_UP_LIMITS.max
        ? t("amountError", { max: formatNumber(TOP_UP_LIMITS.max) })
        : undefined;

  // Errors are surfaced by SettingsSection (inline alert + toast); success resets the form.
  async function handleTopUp() {
    if (!token) return;
    await apiFetch("/transactions/topup", {
      method: "POST",
      token,
      body: { amount: amountValue, provider },
    });
    await Promise.all([refreshUser(), refetch()]);
    setAmount("");
    toast.success(t("topUpSuccess"));
  }

  const sorted = transactions
    ? [...transactions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    : [];

  // Successful movements only — pending/failed transactions never touched the balance.
  const totals = sorted.reduce(
    (sum, transaction) => {
      if (transaction.status !== "SUCCESS") return sum;
      const value = Number(transaction.amount);
      if (transaction.type === "TOPUP") sum.toppedUp += value;
      else if (transaction.type === "EXAM_FEE") sum.spent += value;
      else if (transaction.type === "REFUND") sum.refunded += value;
      return sum;
    },
    { toppedUp: 0, spent: 0, refunded: 0 },
  );

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
      <PageHeader backHref="/dashboard" title={t("title")} subtitle={t("subtitle")} />

      <div className="bg-surface-muted py-8" style={FULL_BLEED}>
        <div
          className={cn(
            "grid items-start gap-6 lg:gap-8",
            canTopUp && "lg:grid-cols-[minmax(0,1fr)_340px]",
          )}
        >
          {canTopUp && (
            <SettingsSection
              id="top-up"
              title={t("topUpTitle")}
              description={t("topUpDescription")}
              hint={t("topUpHint")}
              dirty={amount.trim() !== ""}
              valid={!amountError}
              onSave={handleTopUp}
              submitLabel={t("topUpCta")}
              submittingLabel={t("toppingUp")}
            >
              <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <SettingsField id="amount" label={t("amount")} error={amountError} suffix="RWF">
                    <Input
                      id="amount"
                      type="number"
                      inputMode="numeric"
                      min={TOP_UP_LIMITS.min}
                      max={TOP_UP_LIMITS.max}
                      step={1}
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder={t("amountPlaceholder")}
                      aria-invalid={!!amountError}
                      aria-describedby={amountError ? "amount-error" : undefined}
                      className="h-10 pr-14"
                    />
                  </SettingsField>
                  <div className="flex flex-wrap gap-2" role="group" aria-label={t("quickAmounts")}>
                    {QUICK_AMOUNTS.map((quick) => (
                      <button
                        key={quick}
                        type="button"
                        onClick={() => setAmount(String(quick))}
                        aria-pressed={amountValue === quick}
                        className="rounded-sm border border-border bg-background px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:border-primary focus-visible:outline-none aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary-text"
                      >
                        {formatNumber(quick)}
                      </button>
                    ))}
                  </div>
                </div>
                <SettingsField id="provider" label={t("provider")}>
                  <SearchableSelect
                    id="provider"
                    value={provider}
                    onValueChange={setProvider}
                    options={PROVIDER_OPTIONS}
                    searchPlaceholder={tCommon("search")}
                    emptyText={tCommon("noMatches")}
                    className="h-10"
                  />
                </SettingsField>
              </div>
            </SettingsSection>
          )}

          {/* Balance summary — beside the top-up form on desktop, like the Start exam summary. */}
          <section
            aria-labelledby="balance-title"
            className="overflow-hidden rounded-lg border border-border bg-background lg:sticky lg:top-40"
          >
            <div className="p-5 sm:p-7">
              <h2 id="balance-title" className="text-sm text-muted-foreground">
                {t("currentBalance")}
              </h2>
              <p className="mt-1 font-mono text-3xl font-medium text-foreground tabular-nums">
                {formatRwf(user?.walletBalance ?? 0)}
              </p>
              <dl className="mt-5 flex flex-col divide-y divide-border border-t border-border text-sm">
                <BalanceRow label={t("totalToppedUp")} value={isLoading ? "…" : formatRwf(totals.toppedUp)} />
                <BalanceRow label={t("totalSpent")} value={isLoading ? "…" : formatRwf(totals.spent)} />
                <BalanceRow label={t("totalRefunded")} value={isLoading ? "…" : formatRwf(totals.refunded)} />
              </dl>
            </div>
            <p className="border-t border-border bg-surface-muted/60 px-5 py-4 text-sm text-muted-foreground sm:px-7">
              {t("balanceHint")}
            </p>
          </section>
        </div>
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
