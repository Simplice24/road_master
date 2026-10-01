"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatRwf } from "@/lib/format";
import type { ManagedUser } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SettingsField } from "@/components/app/settings-layout";

// Mirrors backend/src/transactions/dto/adjust-balance.dto.ts.
const MAX_ADJUSTMENT = 99_999_999;

/** Admin wallet correction: a signed whole-RWF amount plus a mandatory reason (audit trail). */
export function AdjustBalanceDialog({
  user,
  onClose,
  onSaved,
}: {
  user: ManagedUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("AdjustBalance");
  const tCommon = useTranslations("Common");
  const { token } = useAuth();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const value = Number(amount);
  const balance = Number(user.walletBalance);
  const amountError =
    amount.trim() === "" || !Number.isInteger(value) || value === 0 || Math.abs(value) > MAX_ADJUSTMENT
      ? t("amountError", { max: formatRwf(MAX_ADJUSTMENT) })
      : balance + value < 0
        ? t("negativeError")
        : undefined;
  const noteError = note.trim() === "" ? t("noteRequired") : undefined;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (amountError || noteError || !token) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await apiFetch("/transactions/adjust", {
        method: "POST",
        token,
        body: { userId: user.id, amount: value, note: note.trim() },
      });
      toast.success(t("saved"));
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-medium">{t("title", { name: user.fullName })}</DialogTitle>
            <DialogDescription>
              {t("description", { balance: formatRwf(user.walletBalance) })}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="max-w-[16rem]">
            <SettingsField id="adjust-amount" label={t("amount")} error={showErrors ? amountError : undefined} suffix="RWF">
              <Input
                id="adjust-amount"
                type="number"
                inputMode="numeric"
                step={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-invalid={showErrors && !!amountError}
                aria-describedby={`adjust-amount-hint${showErrors && amountError ? " adjust-amount-error" : ""}`}
                className="pr-14"
              />
            </SettingsField>
            <p id="adjust-amount-hint" className="mt-1.5 text-xs text-muted-foreground">
              {t("amountHint")}
            </p>
          </div>
          <SettingsField id="adjust-note" label={t("note")} error={showErrors ? noteError : undefined}>
            <Textarea
              id="adjust-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              rows={3}
              aria-invalid={showErrors && !!noteError}
              aria-describedby={showErrors && noteError ? "adjust-note-error" : undefined}
              required
            />
          </SettingsField>
          {amount.trim() !== "" && !amountError && (
            <p className="text-sm text-muted-foreground">
              {t("newBalance", { balance: formatRwf(balance + value) })}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? tCommon("saving") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
