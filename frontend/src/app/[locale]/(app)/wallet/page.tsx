"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Transaction } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet as WalletIcon } from "lucide-react";

const STATUS_VARIANT: Record<Transaction["status"], "default" | "secondary" | "destructive"> = {
  SUCCESS: "default",
  PENDING: "secondary",
  FAILED: "destructive",
};

const PROVIDERS = ["MTN_MOMO", "AIRTEL_MONEY", "CARD"] as const;

export default function WalletPage() {
  const t = useTranslations("Wallet");
  const tType = useTranslations("TransactionType");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const { user, token, refreshUser } = useAuth();
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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card className="bg-primary text-primary-foreground">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 text-primary-foreground/80">
            <WalletIcon className="size-4" />
            {t("currentBalance")}
          </CardDescription>
          <CardTitle className="text-3xl text-primary-foreground">
            {formatNumber(user?.walletBalance ?? 0)} RWF
          </CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("topUpTitle")}</CardTitle>
        </CardHeader>
        <form onSubmit={handleTopUp}>
          <CardContent className="flex flex-col gap-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
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
          </CardContent>
          <CardContent className="pt-0">
            <Button
              type="submit"
              className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? t("toppingUp") : t("topUpCta")}
            </Button>
          </CardContent>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("transactionHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-32 w-full" />}
          {!isLoading && sorted.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noTransactions")}
            </p>
          )}
          {!isLoading && sorted.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{tType(transaction.type)}</TableCell>
                    <TableCell className="tabular-nums">
                      {transaction.type === "TOPUP" || transaction.type === "REFUND" ? "+" : "-"}
                      {formatNumber(transaction.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[transaction.status]}>
                        {transaction.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(transaction.createdAt, locale)}
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
