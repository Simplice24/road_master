"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { formatRwf } from "@/lib/format";
import { PLAN_LIMITS, localized, validateWholeNumber, type PlanFieldError } from "@/lib/plans";
import type { ManagedPlan, ManagedUser, PlanAccessType, UserSubscription } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
import { useSubscriptionName } from "@/components/app/access-status";

const NOTE_MAX = 500;

/** Shared shell: title, description, error alert, required note field, cancel/submit footer. */
function AdminDialog({
  title,
  description,
  submitLabel,
  destructive = false,
  onClose,
  onSubmit,
  canSubmit,
  onSubmitAttempt,
  children,
}: {
  title: string;
  description: string;
  submitLabel: string;
  destructive?: boolean;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
  canSubmit: boolean;
  /** Called on every submit attempt (valid or not), so callers can reveal their own field errors. */
  onSubmitAttempt?: () => void;
  children?: ReactNode;
}) {
  const t = useTranslations("Subscriptions");
  const tCommon = useTranslations("Common");
  const [note, setNote] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const noteError = note.trim() === "" ? t("noteRequired") : undefined;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    onSubmitAttempt?.();
    if (noteError || !canSubmit) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(note.trim());
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-medium">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {children}
          <SettingsField id="admin-note" label={t("note")} error={showErrors ? noteError : undefined}>
            <Textarea
              id="admin-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={NOTE_MAX}
              rows={3}
              placeholder={t("notePlaceholder")}
              aria-invalid={showErrors && !!noteError}
              aria-describedby={showErrors && noteError ? "admin-note-error" : undefined}
              required
            />
          </SettingsField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              className={destructive ? undefined : "btn-primary"}
              disabled={isSubmitting}
            >
              {isSubmitting ? tCommon("saving") : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RevokeSubscriptionDialog({
  subscription,
  onClose,
  onSaved,
}: {
  subscription: UserSubscription;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Subscriptions");
  const { token } = useAuth();
  const nameOf = useSubscriptionName();
  const refundable = subscription.source === "PURCHASE" && subscription.price > 0;
  const [refund, setRefund] = useState(false);

  return (
    <AdminDialog
      title={t("revokeTitle", { name: nameOf(subscription), user: subscription.user.fullName })}
      description={t("revokeBody")}
      submitLabel={t("revoke")}
      destructive
      canSubmit
      onClose={onClose}
      onSubmit={async (note) => {
        await apiFetch(`/subscriptions/${subscription.id}/revoke`, {
          method: "POST",
          token,
          body: { note, refund: refundable && refund },
        });
        toast.success(t("revoked"));
        onSaved();
      }}
    >
      {refundable && (
        <label className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5">
          <Checkbox checked={refund} onCheckedChange={(checked) => setRefund(checked === true)} className="mt-0.5" />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t("refundLabel", { amount: formatRwf(subscription.price) })}</span>
            <span className="text-xs text-muted-foreground">{t("refundDescription")}</span>
          </span>
        </label>
      )}
    </AdminDialog>
  );
}

export function ExtendSubscriptionDialog({
  subscription,
  onClose,
  onSaved,
}: {
  subscription: UserSubscription;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Subscriptions");
  const tErrors = useTranslations("PlanForm.errors");
  const { token } = useAuth();
  const nameOf = useSubscriptionName();
  const isTime = subscription.accessType === "TIME";
  const [amount, setAmount] = useState("");
  const limits = isTime ? PLAN_LIMITS.durationDays : PLAN_LIMITS.attemptLimit;
  const amountError = validateWholeNumber(amount, limits);

  return (
    <AdminDialog
      title={t("extendTitle", { name: nameOf(subscription), user: subscription.user.fullName })}
      description={isTime ? t("extendTimeBody") : t("extendAttemptsBody")}
      submitLabel={t("extend")}
      canSubmit={!amountError}
      onClose={onClose}
      onSubmit={async (note) => {
        await apiFetch(`/subscriptions/${subscription.id}/extend`, {
          method: "POST",
          token,
          body: isTime ? { days: Number(amount), note } : { attempts: Number(amount), note },
        });
        toast.success(t("extended"));
        onSaved();
      }}
    >
      <div className="max-w-[14rem]">
        <SettingsField
          id="extend-amount"
          label={isTime ? t("extraDays") : t("extraAttempts")}
          error={amount !== "" && amountError ? tErrors(amountError.key, amountError.values) : undefined}
        >
          <Input
            id="extend-amount"
            type="number"
            inputMode="numeric"
            min={limits.min}
            max={limits.max}
            step={1}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={amount !== "" && !!amountError}
            aria-describedby={amount !== "" && amountError ? "extend-amount-error" : undefined}
          />
        </SettingsField>
      </div>
    </AdminDialog>
  );
}

const CUSTOM = "custom";

/**
 * Grants a plan's terms (or a custom allowance) for free, e.g. for support cases. Needs the
 * user list (users.view); the plan list (plans.view) is optional — without it only custom
 * grants are offered.
 */
export function GrantSubscriptionDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("Subscriptions");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("PlanForm.errors");
  const locale = useLocale();
  const { token, can } = useAuth();
  const { data: users } = useApi<ManagedUser[]>("/users");
  const { data: plans } = useApi<ManagedPlan[]>(can("plans.view") ? "/plans/manage" : null);

  const [userId, setUserId] = useState("");
  const [planChoice, setPlanChoice] = useState(CUSTOM);
  const [accessType, setAccessType] = useState<PlanAccessType>("ATTEMPTS");
  const [amount, setAmount] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const userOptions = useMemo(
    () => (users ?? []).map((user) => ({ value: user.id, label: user.fullName, description: user.phone })),
    [users],
  );
  const planOptions = useMemo(
    () => [
      { value: CUSTOM, label: t("customAllowance") },
      ...(plans ?? []).map((plan) => ({
        value: plan.id,
        label: localized(plan.name, locale),
        description: plan.isActive ? undefined : t("inactivePlan"),
      })),
    ],
    [plans, locale, t],
  );

  const isCustom = planChoice === CUSTOM;
  const limits = accessType === "TIME" ? PLAN_LIMITS.durationDays : PLAN_LIMITS.attemptLimit;
  const amountError: PlanFieldError | null = isCustom ? validateWholeNumber(amount, limits) : null;
  const userError = userId ? undefined : t("userRequired");

  return (
    <AdminDialog
      title={t("grantTitle")}
      description={t("grantBody")}
      submitLabel={t("grant")}
      canSubmit={!userError && !amountError}
      onSubmitAttempt={() => setShowErrors(true)}
      onClose={onClose}
      onSubmit={async (note) => {
        const body = isCustom
          ? {
              userId,
              accessType,
              ...(accessType === "TIME" ? { durationDays: Number(amount) } : { attemptLimit: Number(amount) }),
              note,
            }
          : { userId, planId: planChoice, note };
        await apiFetch("/subscriptions/grant", { method: "POST", token, body });
        toast.success(t("granted"));
        onSaved();
      }}
    >
      <SettingsField id="grant-user" label={t("user")} error={showErrors ? userError : undefined}>
        <SearchableSelect
          id="grant-user"
          value={userId}
          onValueChange={setUserId}
          aria-describedby={showErrors && userError ? "grant-user-error" : undefined}
          options={userOptions}
          placeholder={t("chooseUser")}
          searchPlaceholder={tCommon("search")}
          emptyText={tCommon("noMatches")}
          className="h-10"
        />
      </SettingsField>
      <SettingsField id="grant-plan" label={t("plan")}>
        <SearchableSelect
          id="grant-plan"
          value={planChoice}
          onValueChange={setPlanChoice}
          options={planOptions}
          searchPlaceholder={tCommon("search")}
          emptyText={tCommon("noMatches")}
          className="h-10"
        />
      </SettingsField>
      {isCustom && (
        <>
          <RadioGroup
            value={accessType}
            onValueChange={(value) => setAccessType(value as PlanAccessType)}
            aria-label={t("accessType")}
            className="grid gap-3 sm:grid-cols-2"
          >
            {(["ATTEMPTS", "TIME"] as const).map((type) => (
              <Label
                key={type}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 font-normal has-data-checked:border-primary has-data-checked:bg-primary/5"
              >
                <RadioGroupItem value={type} />
                {t(`accessTypes.${type}`)}
              </Label>
            ))}
          </RadioGroup>
          <div className="max-w-[14rem]">
            <SettingsField
              id="grant-amount"
              label={accessType === "TIME" ? t("days") : t("attempts")}
              error={(showErrors || amount !== "") && amountError ? tErrors(amountError.key, amountError.values) : undefined}
            >
              <Input
                id="grant-amount"
                type="number"
                inputMode="numeric"
                min={limits.min}
                max={limits.max}
                step={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-invalid={!!amountError && (showErrors || amount !== "")}
              />
            </SettingsField>
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground">{t("grantFreeNote")}</p>
    </AdminDialog>
  );
}
