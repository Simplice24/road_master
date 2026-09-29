"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  EXAM_CONFIG_LIMITS,
  validateInteger,
  validateName,
  validatePrice,
  type FieldError,
} from "@/lib/exam-config-validation";
import type { ExamConfig } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/app/page-header";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { RequirePermission } from "@/components/app/require-permission";

type ConfigPayload = Partial<{
  name: string;
  numberOfQuestions: number;
  passMarkPercent: number;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}>;

// Full-bleed grey band (the reference's settings area) without 100vw overflow: the shadow paints
// sideways past the container and the clip-path trims it to this element's own height.
const FULL_BLEED = {
  boxShadow: "0 0 0 100vmax var(--surface-muted)",
  clipPath: "inset(0 -100vmax)",
} as const;

function useErrorText() {
  const t = useTranslations("ExamConfig.errors");
  return (error: FieldError | null) => (error ? t(error.key, error.values) : undefined);
}

/* ------------------------------------------------------------------------------------------ */

function ExamConfigContent() {
  const t = useTranslations("ExamConfig");
  const tAccess = useTranslations("Access");
  const { can } = useAuth();
  const canUpdate = can("examConfig.update");
  const canCreate = can("examConfig.create");
  const canDelete = can("examConfig.delete");

  const { data: configs, isLoading, error, refetch } = useApi<ExamConfig[]>("/exam-config");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const selected = configs?.find((config) => config.id === selectedId) ?? configs?.[0];

  return (
    <div className="flex flex-col">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="mt-8 bg-surface-muted py-8" style={FULL_BLEED}>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!canUpdate && !isLoading && (
          <p className="mb-6 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
            {tAccess("viewOnly")}
          </p>
        )}

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
            <Skeleton className="h-40 w-full" />
            <div className="flex flex-col gap-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-8">
            <nav aria-label={t("configsNav")} className="flex flex-col">
              <ul className="flex flex-col border-l border-border">
                {configs?.map((config) => {
                  const active = config.id === selected?.id;
                  return (
                    <li key={config.id}>
                      <button
                        type="button"
                        aria-current={active ? "true" : undefined}
                        onClick={() => setSelectedId(config.id)}
                        className={cn(
                          "-ml-px flex w-full flex-col items-start gap-0.5 border-l-2 px-4 py-2.5 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset",
                          active
                            ? "border-primary bg-primary/10 text-primary-text"
                            : "border-transparent text-muted-foreground hover:bg-background hover:text-foreground",
                        )}
                      >
                        <span className="font-mono text-sm tracking-wide uppercase">{config.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {config.isActive ? t("active") : t("inactive")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="mt-3 flex items-center gap-1.5 self-start rounded-sm px-4 py-1.5 font-mono text-xs tracking-wide text-primary-text uppercase hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <Plus className="size-3.5" aria-hidden />
                  {t("newConfig")}
                </button>
              )}
            </nav>

            <div className="flex min-w-0 flex-col gap-6">
              {selected ? (
                // Keyed so every section's draft resets when switching configs.
                <ConfigSections
                  key={`${selected.id}-${selected.updatedAt}`}
                  config={selected}
                  readOnly={!canUpdate}
                  canDelete={canDelete}
                  onSaved={refetch}
                  onDeleted={() => {
                    setSelectedId(null);
                    refetch();
                  }}
                />
              ) : (
                <p className="rounded-lg border border-border bg-background px-6 py-12 text-center text-sm text-muted-foreground">
                  {t("noConfigs")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <CreateConfigDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(config) => {
          setSelectedId(config.id);
          refetch();
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */

interface ConfigSectionsProps {
  config: ExamConfig;
  readOnly: boolean;
  canDelete: boolean;
  onSaved: () => void;
  onDeleted: () => void;
}

function ConfigSections({ config, readOnly, canDelete, onSaved, onDeleted }: ConfigSectionsProps) {
  const t = useTranslations("ExamConfig");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const { token } = useAuth();

  const [name, setName] = useState(config.name);
  const [isActive, setIsActive] = useState(config.isActive);
  const [numberOfQuestions, setNumberOfQuestions] = useState(String(config.numberOfQuestions));
  const [passMarkPercent, setPassMarkPercent] = useState(String(config.passMarkPercent));
  const [durationMinutes, setDurationMinutes] = useState(String(config.durationMinutes));
  const [price, setPrice] = useState(String(Number(config.price)));
  const [deleteOpen, setDeleteOpen] = useState(false);

  const nameError = validateName(name);
  const questionsError = validateInteger(numberOfQuestions, EXAM_CONFIG_LIMITS.numberOfQuestions);
  const passMarkError = validateInteger(passMarkPercent, EXAM_CONFIG_LIMITS.passMarkPercent);
  const durationError = validateInteger(durationMinutes, EXAM_CONFIG_LIMITS.durationMinutes);
  const priceError = validatePrice(price);

  async function save(payload: ConfigPayload) {
    if (!token) return;
    await apiFetch(`/exam-config/${config.id}`, { method: "PUT", token, body: payload });
    toast.success(t("saved"));
    onSaved();
  }

  async function handleDelete() {
    if (!token) return;
    try {
      await apiFetch(`/exam-config/${config.id}`, { method: "DELETE", token });
      toast.success(t("deleted"));
      onDeleted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon("error"));
      throw err;
    }
  }

  return (
    <>
      <SettingsSection
        title={t("general")}
        description={t("generalDescription")}
        hint={t("nameHint")}
        readOnly={readOnly}
        dirty={name.trim() !== config.name || isActive !== config.isActive}
        valid={!nameError}
        onSave={() => save({ name: name.trim(), isActive })}
      >
        <div className="flex flex-col gap-5">
          <Field id="cfg-name" label={t("name")} error={errorText(nameError)}>
            <Input
              id="cfg-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={readOnly}
              aria-invalid={!!nameError}
              className="max-w-md"
            />
          </Field>
          <label className="flex max-w-md items-start justify-between gap-4">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{t("activeLabel")}</span>
              <span className="text-sm text-muted-foreground">{t("activeDescription")}</span>
            </span>
            <Switch checked={isActive} onCheckedChange={setIsActive} disabled={readOnly} />
          </label>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("scoring")}
        description={t("scoringDescription")}
        hint={t("scoringHint")}
        readOnly={readOnly}
        dirty={
          numberOfQuestions !== String(config.numberOfQuestions) ||
          passMarkPercent !== String(config.passMarkPercent)
        }
        valid={!questionsError && !passMarkError}
        onSave={() =>
          save({
            numberOfQuestions: Number(numberOfQuestions),
            passMarkPercent: Number(passMarkPercent),
          })
        }
      >
        <div className="grid max-w-md gap-5 sm:grid-cols-2">
          <Field id="cfg-questions" label={t("numberOfQuestions")} error={errorText(questionsError)}>
            <Input
              id="cfg-questions"
              type="number"
              inputMode="numeric"
              min={EXAM_CONFIG_LIMITS.numberOfQuestions.min}
              max={EXAM_CONFIG_LIMITS.numberOfQuestions.max}
              step={1}
              value={numberOfQuestions}
              onChange={(event) => setNumberOfQuestions(event.target.value)}
              disabled={readOnly}
              aria-invalid={!!questionsError}
            />
          </Field>
          <Field id="cfg-passmark" label={t("passMark")} error={errorText(passMarkError)} suffix="%">
            <Input
              id="cfg-passmark"
              type="number"
              inputMode="numeric"
              min={EXAM_CONFIG_LIMITS.passMarkPercent.min}
              max={EXAM_CONFIG_LIMITS.passMarkPercent.max}
              step={1}
              value={passMarkPercent}
              onChange={(event) => setPassMarkPercent(event.target.value)}
              disabled={readOnly}
              aria-invalid={!!passMarkError}
              className="pr-8"
            />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("duration")}
        description={t("durationDescription")}
        hint={t("durationHint")}
        readOnly={readOnly}
        dirty={durationMinutes !== String(config.durationMinutes)}
        valid={!durationError}
        onSave={() => save({ durationMinutes: Number(durationMinutes) })}
      >
        <div className="max-w-[14rem]">
          <Field
            id="cfg-duration"
            label={t("durationMinutes")}
            error={errorText(durationError)}
            suffix={t("minutesShort")}
          >
            <Input
              id="cfg-duration"
              type="number"
              inputMode="numeric"
              min={EXAM_CONFIG_LIMITS.durationMinutes.min}
              max={EXAM_CONFIG_LIMITS.durationMinutes.max}
              step={1}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              disabled={readOnly}
              aria-invalid={!!durationError}
              className="pr-12"
            />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("price")}
        description={t("priceDescription")}
        hint={t("priceHint")}
        readOnly={readOnly}
        dirty={Number(price) !== Number(config.price) || price.trim() === ""}
        valid={!priceError}
        onSave={() => save({ price: Number(price) })}
      >
        <div className="max-w-[14rem]">
          <Field id="cfg-price" label={t("priceLabel")} error={errorText(priceError)} suffix="RWF">
            <Input
              id="cfg-price"
              type="number"
              inputMode="decimal"
              min={EXAM_CONFIG_LIMITS.price.min}
              max={EXAM_CONFIG_LIMITS.price.max}
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              disabled={readOnly}
              aria-invalid={!!priceError}
              className="pr-14"
            />
          </Field>
        </div>
      </SettingsSection>

      {canDelete && (
        <section className="overflow-hidden rounded-lg border border-destructive/30 bg-background">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <h2 className="font-display text-xl font-medium">{t("dangerZone")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("dangerDescription")}</p>
            </div>
            <Button variant="destructive" className="shrink-0" onClick={() => setDeleteOpen(true)}>
              {t("deleteCta")}
            </Button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteTitle", { name: config.name })}
        description={t("deleteBody")}
        confirmLabel={t("deleteCta")}
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}

/* ------------------------------------------------------------------------------------------ */

interface SettingsSectionProps {
  title: string;
  description: string;
  hint: string;
  readOnly: boolean;
  dirty: boolean;
  valid: boolean;
  onSave: () => Promise<void>;
  children: ReactNode;
}

/** One card in the Team-settings layout: title + description, fields, and a grey footer with a
 * hint on the left and "Save changes" on the right. Each section saves only its own fields. */
function SettingsSection({ title, description, hint, readOnly, dirty, valid, onSave, children }: SettingsSectionProps) {
  const t = useTranslations("ExamConfig");
  const tCommon = useTranslations("Common");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!dirty || !valid) return;
    setError(null);
    setIsSaving(true);
    try {
      await onSave();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : tCommon("error");
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-background">
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-5 p-5 sm:p-7">
          <div>
            <h2 className="font-display text-xl font-medium">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {children}
        </div>
        <div className="flex flex-col gap-3 border-t border-border bg-surface-muted/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className="text-sm text-muted-foreground">{hint}</p>
          {!readOnly && (
            <Button type="submit" className="btn-primary h-10 shrink-0 px-5" disabled={!dirty || !valid || isSaving}>
              {isSaving ? tCommon("saving") : t("saveChanges")}
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}

function Field({
  id,
  label,
  error,
  suffix,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  suffix?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {children}
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */

function CreateConfigDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (config: ExamConfig) => void;
}) {
  return open ? <CreateConfigForm onOpenChange={onOpenChange} onCreated={onCreated} /> : null;
}

function CreateConfigForm({
  onOpenChange,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  onCreated: (config: ExamConfig) => void;
}) {
  const t = useTranslations("ExamConfig");
  const tCommon = useTranslations("Common");
  const errorText = useErrorText();
  const { token } = useAuth();

  // Defaults match the Prisma schema's column defaults.
  const [name, setName] = useState("");
  const [numberOfQuestions, setNumberOfQuestions] = useState("20");
  const [passMarkPercent, setPassMarkPercent] = useState("60");
  const [durationMinutes, setDurationMinutes] = useState("20");
  const [price, setPrice] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errors = {
    name: validateName(name),
    numberOfQuestions: validateInteger(numberOfQuestions, EXAM_CONFIG_LIMITS.numberOfQuestions),
    passMarkPercent: validateInteger(passMarkPercent, EXAM_CONFIG_LIMITS.passMarkPercent),
    durationMinutes: validateInteger(durationMinutes, EXAM_CONFIG_LIMITS.durationMinutes),
    price: validatePrice(price),
  };
  const shown = (fieldError: FieldError | null) => (showErrors ? errorText(fieldError) : undefined);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (!token || Object.values(errors).some(Boolean)) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const created = await apiFetch<ExamConfig>("/exam-config", {
        method: "POST",
        token,
        body: {
          name: name.trim(),
          numberOfQuestions: Number(numberOfQuestions),
          passMarkPercent: Number(passMarkPercent),
          durationMinutes: Number(durationMinutes),
          price: Number(price),
          isActive,
        },
      });
      toast.success(t("created"));
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-medium">{t("createTitle")}</DialogTitle>
            <DialogDescription>{t("subtitle")}</DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Field id="new-name" label={t("name")} error={shown(errors.name)}>
            <Input id="new-name" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="new-questions" label={t("numberOfQuestions")} error={shown(errors.numberOfQuestions)}>
              <Input
                id="new-questions"
                type="number"
                inputMode="numeric"
                value={numberOfQuestions}
                onChange={(event) => setNumberOfQuestions(event.target.value)}
              />
            </Field>
            <Field id="new-passmark" label={t("passMark")} error={shown(errors.passMarkPercent)} suffix="%">
              <Input
                id="new-passmark"
                type="number"
                inputMode="numeric"
                value={passMarkPercent}
                onChange={(event) => setPassMarkPercent(event.target.value)}
                className="pr-8"
              />
            </Field>
            <Field
              id="new-duration"
              label={t("durationMinutes")}
              error={shown(errors.durationMinutes)}
              suffix={t("minutesShort")}
            >
              <Input
                id="new-duration"
                type="number"
                inputMode="numeric"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
                className="pr-12"
              />
            </Field>
            <Field id="new-price" label={t("priceLabel")} error={shown(errors.price)} suffix="RWF">
              <Input
                id="new-price"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="pr-14"
              />
            </Field>
          </div>
          <label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
            <span className="text-sm font-medium">{t("activeLabel")}</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? tCommon("saving") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ExamConfigPage() {
  return (
    <RequirePermission anyOf={["examConfig.view"]}>
      <ExamConfigContent />
    </RequirePermission>
  );
}
