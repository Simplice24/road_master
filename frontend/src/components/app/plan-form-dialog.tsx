"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { routing } from "@/i18n/routing";
import {
  PLAN_LIMITS,
  featureTextToLines,
  localized,
  planFeatureLines,
  validateFeatureText,
  validatePlanName,
  validateWholeNumber,
  type PlanFieldError,
} from "@/lib/plans";
import type { LocalizedLines, LocalizedText, ManagedPlan, PlanAccessType } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LanguageFlag } from "@/components/language-flag";
import { SettingsField } from "@/components/app/settings-layout";
import { PricingCard } from "@/components/pricing-card";

interface PlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The plan being edited; omit to create one. */
  plan?: ManagedPlan;
  onSaved: () => void;
}

export function PlanFormDialog(props: PlanFormDialogProps) {
  // Remount per plan/open so the form always starts from the row being edited.
  return props.open ? <PlanForm key={props.plan?.id ?? "new"} {...props} /> : null;
}

const LOCALES = routing.locales;
const DEFAULT_LOCALE = routing.defaultLocale;

function PlanForm({ open, onOpenChange, plan, onSaved }: PlanFormDialogProps) {
  const t = useTranslations("PlanForm");
  const tPricing = useTranslations("Pricing");
  const tLanguage = useTranslations("LanguageSwitcher");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("PlanForm.errors");
  const uiLocale = useLocale();
  const { token } = useAuth();
  const isEdit = !!plan;

  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(LOCALES.map((locale) => [locale, plan?.name[locale] ?? ""])),
  );
  const [features, setFeatures] = useState<Record<string, string>>(() =>
    Object.fromEntries(LOCALES.map((locale) => [locale, (plan?.extraFeatures?.[locale] ?? []).join("\n")])),
  );
  const [price, setPrice] = useState(plan ? String(plan.price) : "");
  const [accessType, setAccessType] = useState<PlanAccessType>(plan?.accessType ?? "ATTEMPTS");
  const [attemptLimit, setAttemptLimit] = useState(plan?.attemptLimit ? String(plan.attemptLimit) : "");
  const [durationDays, setDurationDays] = useState(plan?.durationDays ? String(plan.durationDays) : "");
  const [isMostPopular, setIsMostPopular] = useState(plan?.isMostPopular ?? false);
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const [tab, setTab] = useState<string>(DEFAULT_LOCALE);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only the field relevant to the access type is validated (and sent); the other is hidden.
  const errors = {
    names: Object.fromEntries(
      LOCALES.map((locale) => [locale, validatePlanName(names[locale], locale === DEFAULT_LOCALE)]),
    ) as Record<string, PlanFieldError | null>,
    features: Object.fromEntries(
      LOCALES.map((locale) => [locale, validateFeatureText(features[locale])]),
    ) as Record<string, PlanFieldError | null>,
    price: validateWholeNumber(price, PLAN_LIMITS.price),
    attemptLimit: accessType === "ATTEMPTS" ? validateWholeNumber(attemptLimit, PLAN_LIMITS.attemptLimit) : null,
    durationDays: accessType === "TIME" ? validateWholeNumber(durationDays, PLAN_LIMITS.durationDays) : null,
  };
  const localeHasError = (locale: string) => !!errors.names[locale] || !!errors.features[locale];
  const hasErrors =
    LOCALES.some(localeHasError) || !!errors.price || !!errors.attemptLimit || !!errors.durationDays;
  const shown = (fieldError: PlanFieldError | null) =>
    showErrors && fieldError ? tErrors(fieldError.key, fieldError.values) : undefined;

  const nameText: LocalizedText = Object.fromEntries(
    LOCALES.map((locale) => [locale, names[locale].trim()]).filter(([, value]) => value),
  );
  const featureLines: LocalizedLines = Object.fromEntries(
    LOCALES.map((locale) => [locale, featureTextToLines(features[locale])]).filter(([, lines]) => lines.length > 0),
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (hasErrors) {
      // Jump to the first language tab with a problem so the error is visible.
      const firstBad = LOCALES.find(localeHasError);
      if (firstBad) setTab(firstBad);
      return;
    }
    if (!token) return;
    setError(null);
    setIsSubmitting(true);
    const body = {
      name: nameText,
      extraFeatures: Object.keys(featureLines).length > 0 ? featureLines : null,
      price: Number(price),
      accessType,
      attemptLimit: accessType === "ATTEMPTS" ? Number(attemptLimit) : null,
      durationDays: accessType === "TIME" ? Number(durationDays) : null,
      isMostPopular,
      isActive,
    };
    try {
      if (isEdit) {
        await apiFetch(`/plans/${plan.id}`, { method: "PATCH", token, body });
      } else {
        await apiFetch("/plans", { method: "POST", token, body });
      }
      toast.success(isEdit ? t("updated") : t("created"));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const previewTerms = {
    accessType,
    attemptLimit: Number(attemptLimit) || 0,
    durationDays: Number(durationDays) || 0,
    extraFeatures: featureLines,
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-medium">
              {isEdit ? t("editTitle") : t("createTitle")}
            </DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          {isEdit && (
            <Alert>
              <Info aria-hidden />
              <AlertDescription>
                {t("futureOnlyNote", { count: plan._count.subscriptions })}
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
            <div className="flex min-w-0 flex-col gap-5">
              {/* Translatable text, one tab per supported locale. */}
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t("textSection")}</span>
                <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
                  <TabsList className="h-9 w-full">
                    {LOCALES.map((locale) => (
                      <TabsTrigger key={locale} value={locale} className="gap-2">
                        <LanguageFlag locale={locale} />
                        {tLanguage(locale)}
                        {locale === DEFAULT_LOCALE && <span aria-hidden>*</span>}
                        {showErrors && localeHasError(locale) && (
                          <span className="size-1.5 rounded-full bg-destructive" aria-label={t("tabHasErrors")} />
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {LOCALES.map((locale) => (
                    <TabsContent key={locale} value={locale} className="flex flex-col gap-4 pt-2">
                      <SettingsField
                        id={`plan-name-${locale}`}
                        label={locale === DEFAULT_LOCALE ? t("nameRequired") : t("nameOptional")}
                        error={shown(errors.names[locale])}
                      >
                        <Input
                          id={`plan-name-${locale}`}
                          value={names[locale]}
                          onChange={(event) => setNames({ ...names, [locale]: event.target.value })}
                          maxLength={PLAN_LIMITS.nameMaxLength}
                          placeholder={locale === DEFAULT_LOCALE ? undefined : names[DEFAULT_LOCALE]}
                          aria-invalid={!!shown(errors.names[locale])}
                          aria-describedby={shown(errors.names[locale]) ? `plan-name-${locale}-error` : undefined}
                          required={locale === DEFAULT_LOCALE}
                        />
                      </SettingsField>
                      <SettingsField
                        id={`plan-features-${locale}`}
                        label={t("extraFeatures")}
                        error={shown(errors.features[locale])}
                      >
                        <Textarea
                          id={`plan-features-${locale}`}
                          value={features[locale]}
                          onChange={(event) => setFeatures({ ...features, [locale]: event.target.value })}
                          rows={3}
                          placeholder={t("extraFeaturesPlaceholder")}
                          aria-invalid={!!shown(errors.features[locale])}
                          aria-describedby={`plan-features-${locale}-hint${
                            shown(errors.features[locale]) ? ` plan-features-${locale}-error` : ""
                          }`}
                        />
                      </SettingsField>
                      <p id={`plan-features-${locale}-hint`} className="-mt-2 text-xs text-muted-foreground">
                        {locale === DEFAULT_LOCALE ? t("extraFeaturesHint") : t("fallbackHint")}
                      </p>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              <div className="max-w-[14rem]">
                <SettingsField id="plan-price" label={t("price")} error={shown(errors.price)} suffix="RWF">
                  <Input
                    id="plan-price"
                    type="number"
                    inputMode="numeric"
                    min={PLAN_LIMITS.price.min}
                    max={PLAN_LIMITS.price.max}
                    step={1}
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    aria-invalid={!!shown(errors.price)}
                    aria-describedby={shown(errors.price) ? "plan-price-error" : undefined}
                    className="pr-14"
                  />
                </SettingsField>
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">{t("accessType")}</legend>
                <RadioGroup
                  value={accessType}
                  onValueChange={(value) => setAccessType(value as PlanAccessType)}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  {(["ATTEMPTS", "TIME"] as const).map((type) => (
                    <label
                      key={type}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-surface-muted/60 has-data-checked:border-primary has-data-checked:bg-primary/5"
                    >
                      <RadioGroupItem value={type} className="mt-1" />
                      <span className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">{t(`accessTypes.${type}.label`)}</span>
                        <span className="text-xs text-muted-foreground">{t(`accessTypes.${type}.description`)}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </fieldset>

              <div className="max-w-[14rem]">
                {accessType === "ATTEMPTS" ? (
                  <SettingsField id="plan-attempts" label={t("attemptLimit")} error={shown(errors.attemptLimit)}>
                    <Input
                      id="plan-attempts"
                      type="number"
                      inputMode="numeric"
                      min={PLAN_LIMITS.attemptLimit.min}
                      max={PLAN_LIMITS.attemptLimit.max}
                      step={1}
                      value={attemptLimit}
                      onChange={(event) => setAttemptLimit(event.target.value)}
                      aria-invalid={!!shown(errors.attemptLimit)}
                      aria-describedby={shown(errors.attemptLimit) ? "plan-attempts-error" : undefined}
                    />
                  </SettingsField>
                ) : (
                  <SettingsField
                    id="plan-days"
                    label={t("durationDays")}
                    error={shown(errors.durationDays)}
                    suffix={t("daysShort")}
                  >
                    <Input
                      id="plan-days"
                      type="number"
                      inputMode="numeric"
                      min={PLAN_LIMITS.durationDays.min}
                      max={PLAN_LIMITS.durationDays.max}
                      step={1}
                      value={durationDays}
                      onChange={(event) => setDurationDays(event.target.value)}
                      aria-invalid={!!shown(errors.durationDays)}
                      aria-describedby={shown(errors.durationDays) ? "plan-days-error" : undefined}
                      className="pr-14"
                    />
                  </SettingsField>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <ToggleRow
                  id="plan-popular"
                  label={t("mostPopular")}
                  description={t("mostPopularDescription")}
                  checked={isMostPopular}
                  onCheckedChange={setIsMostPopular}
                />
                <ToggleRow
                  id="plan-active"
                  label={t("active")}
                  description={t("activeDescription")}
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>

            {/* Live preview — the same card candidates see, in the current UI language. */}
            <aside aria-labelledby="plan-preview-title" className="flex flex-col gap-3 md:sticky md:top-0 md:self-start">
              <h3 id="plan-preview-title" className="text-sm font-medium">
                {t("preview")}
              </h3>
              <div className={cn("rounded-lg bg-surface-muted p-4 pt-6", !isActive && "opacity-60")}>
                <PricingCard
                  name={localized(nameText, uiLocale) || t("namePlaceholder")}
                  price={Number(price) || 0}
                  currency="RWF"
                  perLabel={tPricing("perBundle")}
                  features={planFeatureLines(previewTerms, tPricing, uiLocale)}
                  featured={isMostPopular}
                  featuredLabel={tPricing("mostPopular")}
                  action={
                    <Button
                      type="button"
                      tabIndex={-1}
                      aria-hidden
                      className={cn("pointer-events-none h-10 w-full", isMostPopular ? "btn-primary" : "btn-tint")}
                    >
                      {tPricing("cta")}
                    </Button>
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {isActive ? t("previewHint", { language: tLanguage(uiLocale) }) : t("previewInactive")}
              </p>
            </aside>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? tCommon("saving") : isEdit ? tCommon("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
      <span className="flex flex-col gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        <span id={`${id}-description`} className="text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} aria-describedby={`${id}-description`} />
    </div>
  );
}
