"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, CreditCard } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatRwf } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SettingsField } from "@/components/app/settings-layout";

// Mirrors backend/src/transactions/dto/topup.dto.ts.
type Method = "MTN_MOMO" | "AIRTEL_MONEY" | "CARD";
type CardBrand = "VISA" | "MASTERCARD";
const MOBILE_MONEY_PREFIXES: Record<Exclude<Method, "CARD">, string[]> = {
  MTN_MOMO: ["078", "079"],
  AIRTEL_MONEY: ["072", "073"],
};

/** Same canonical 07XXXXXXXX form the API stores ("+250 788…" / "250788…" are accepted too). */
function normalizePhone(value: string) {
  const digits = value.replace(/[\s()-]/g, "").replace(/^\+/, "");
  return digits.startsWith("250") ? `0${digits.slice(3)}` : digits;
}

function detectBrand(digits: string): CardBrand | null {
  if (/^4/.test(digits)) return "VISA";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return "MASTERCARD";
  return null;
}

function passesLuhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

const onlyDigits = (value: string, max: number) => value.replace(/\D/g, "").slice(0, max);

function MethodIcon({ method }: { method: Method }) {
  if (method === "CARD") {
    return (
      <span className="flex size-9 items-center justify-center rounded-full text-foreground">
        <CreditCard className="size-5" aria-hidden />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 items-center justify-center rounded-full font-sans text-[0.6rem] font-bold",
        method === "MTN_MOMO" ? "bg-[#ffcb05] text-black" : "bg-[#e40000] text-white",
      )}
    >
      {method === "MTN_MOMO" ? "MTN" : "airtel"}
    </span>
  );
}

function CardBrandMarks({ active }: { active: CardBrand | null }) {
  return (
    <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2">
      <span
        className={cn(
          "font-sans text-xs font-extrabold italic text-[#1a1f71] transition-opacity dark:text-white",
          active && active !== "VISA" && "opacity-30",
        )}
      >
        VISA
      </span>
      <span className={cn("flex transition-opacity", active && active !== "MASTERCARD" && "opacity-30")}>
        <span className="size-4 rounded-full bg-[#eb001b]" />
        <span className="-ml-1.5 size-4 rounded-full bg-[#f79e1b] mix-blend-multiply dark:mix-blend-normal" />
      </span>
    </span>
  );
}

/**
 * Second step of a wallet top-up: choose how to pay (MTN MoMo, Airtel Money or card) and enter
 * the payer details the API keeps for reconciliation. Cards send only brand, last 4, expiry and
 * holder name — the full number and CVV are validated here and never leave the browser.
 */
export function TopUpPaymentDialog({
  amount,
  onClose,
  onPaid,
}: {
  amount: number;
  onClose: () => void;
  onPaid: () => Promise<void> | void;
}) {
  const t = useTranslations("TopUpPayment");
  const tCommon = useTranslations("Common");
  const { token } = useAuth();
  const [method, setMethod] = useState<Method>("MTN_MOMO");
  const [phone, setPhone] = useState("");
  const [holder, setHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const payLabel = t("pay", { amount: formatRwf(amount) });

  // Mobile money
  const normalizedPhone = normalizePhone(phone);
  const phoneError =
    method === "CARD"
      ? undefined
      : !/^07\d{8}$/.test(normalizedPhone) ||
          !MOBILE_MONEY_PREFIXES[method].some((prefix) => normalizedPhone.startsWith(prefix))
        ? t(method === "MTN_MOMO" ? "mtnPhoneError" : "airtelPhoneError")
        : undefined;

  // Card
  const cardDigits = cardNumber.replace(/\D/g, "");
  const brand = detectBrand(cardDigits);
  const month = Number(expiryMonth);
  const year = 2000 + Number(expiryYear);
  const now = new Date();
  const holderError = holder.trim().length < 2 ? t("holderError") : undefined;
  const cardNumberError =
    cardDigits.length < 13 || !passesLuhn(cardDigits)
      ? t("cardNumberError")
      : !brand
        ? t("cardBrandError")
        : undefined;
  const expiryError =
    expiryMonth === "" || expiryYear.length !== 2 || month < 1 || month > 12
      ? t("expiryError")
      : year * 12 + month < now.getFullYear() * 12 + now.getMonth() + 1
        ? t("expiredError")
        : undefined;
  const cvvError = !/^\d{3}$/.test(cvv) ? t("cvvError") : undefined;

  const invalid =
    method === "CARD" ? !!(holderError || cardNumberError || expiryError || cvvError) : !!phoneError;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (invalid || !token) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await apiFetch("/transactions/topup", {
        method: "POST",
        token,
        body:
          method === "CARD"
            ? {
                amount,
                provider: method,
                cardHolderName: holder.trim(),
                cardBrand: brand,
                cardLast4: cardDigits.slice(-4),
                cardExpiryMonth: month,
                cardExpiryYear: year,
              }
            : { amount, provider: method, payerPhone: normalizedPhone },
      });
      await onPaid();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function selectMethod(next: Method) {
    setMethod(next);
    setShowErrors(false);
    setError(null);
  }

  const methods: { value: Method; label: string }[] = [
    { value: "MTN_MOMO", label: t("mtn") },
    { value: "AIRTEL_MONEY", label: t("airtel") },
    { value: "CARD", label: t("card") },
  ];

  return (
    <Dialog open onOpenChange={(next) => !next && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-2 sm:max-w-3xl sm:p-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:min-h-[26rem]">
          {/* Method list */}
          <div className="rounded-lg border border-border bg-surface-muted p-4 sm:p-5">
            <DialogTitle className="font-display text-base font-medium">{t("title")}</DialogTitle>
            <DialogDescription className="sr-only">{t("description", { amount: formatRwf(amount) })}</DialogDescription>
            <div role="radiogroup" aria-label={t("title")} className="mt-4 flex flex-col gap-1">
              {methods.map(({ value, label }) => {
                const selected = method === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => selectMethod(value)}
                    disabled={isSubmitting}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                      selected ? "bg-primary/10 text-primary-text" : "text-foreground hover:bg-background",
                    )}
                  >
                    <MethodIcon method={value} />
                    <span className="flex-1 font-medium">{label}</span>
                    {!selected && <ChevronRight className="size-4 text-muted-foreground" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Details for the chosen method */}
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 p-3 pt-1 sm:p-4 md:pr-10">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {method === "CARD" ? (
              <>
                <p className="font-medium text-foreground">{t("cardHeading")}</p>
                <SettingsField id="card-holder" label={t("holder")} error={showErrors ? holderError : undefined}>
                  <Input
                    id="card-holder"
                    autoComplete="cc-name"
                    value={holder}
                    onChange={(event) => setHolder(event.target.value)}
                    maxLength={100}
                    placeholder={t("holderPlaceholder")}
                    aria-invalid={showErrors && !!holderError}
                    className="h-10"
                  />
                </SettingsField>
                <SettingsField id="card-number" label={t("cardNumber")} error={showErrors ? cardNumberError : undefined}>
                  <Input
                    id="card-number"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={cardNumber}
                    onChange={(event) =>
                      setCardNumber(onlyDigits(event.target.value, 19).replace(/(\d{4})(?=\d)/g, "$1 "))
                    }
                    placeholder="1234 5678 9012 3456"
                    aria-invalid={showErrors && !!cardNumberError}
                    className="h-10 pr-24 font-mono tabular-nums"
                  />
                  <CardBrandMarks active={brand} />
                </SettingsField>
                <div className="grid grid-cols-2 gap-4">
                  <fieldset className="flex flex-col gap-1.5">
                    <legend className="mb-1.5 text-sm font-medium">{t("expiry")}</legend>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        aria-label={t("expiryMonth")}
                        inputMode="numeric"
                        autoComplete="cc-exp-month"
                        value={expiryMonth}
                        onChange={(event) => setExpiryMonth(onlyDigits(event.target.value, 2))}
                        placeholder="MM"
                        aria-invalid={showErrors && !!expiryError}
                        className="h-10 font-mono"
                      />
                      <Input
                        aria-label={t("expiryYear")}
                        inputMode="numeric"
                        autoComplete="cc-exp-year"
                        value={expiryYear}
                        onChange={(event) => setExpiryYear(onlyDigits(event.target.value, 2))}
                        placeholder="YY"
                        aria-invalid={showErrors && !!expiryError}
                        className="h-10 font-mono"
                      />
                    </div>
                    {showErrors && expiryError && (
                      <p role="alert" className="text-xs text-destructive">
                        {expiryError}
                      </p>
                    )}
                  </fieldset>
                  <SettingsField id="card-cvv" label={t("cvv")} error={showErrors ? cvvError : undefined}>
                    <Input
                      id="card-cvv"
                      type="password"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      value={cvv}
                      onChange={(event) => setCvv(onlyDigits(event.target.value, 3))}
                      placeholder="123"
                      aria-invalid={showErrors && !!cvvError}
                      className="h-10 font-mono"
                    />
                  </SettingsField>
                </div>
                <Button type="submit" className="btn-primary mt-2 h-11 w-full" disabled={isSubmitting}>
                  {isSubmitting ? t("processing") : payLabel}
                </Button>
                <p className="text-xs text-muted-foreground">{t("cardSecurityNote")}</p>
              </>
            ) : (
              <>
                <SettingsField
                  id="payer-phone"
                  label={t(method === "MTN_MOMO" ? "mtnPhoneLabel" : "airtelPhoneLabel")}
                  error={showErrors ? phoneError : undefined}
                >
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      id="payer-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder={method === "MTN_MOMO" ? "ex: 078/9xxxxxxx" : "ex: 072/3xxxxxxx"}
                      aria-invalid={showErrors && !!phoneError}
                      aria-describedby={showErrors && phoneError ? "payer-phone-error" : undefined}
                      className="h-11 font-mono sm:flex-1"
                    />
                    <Button type="submit" className="btn-primary h-11 shrink-0 px-6" disabled={isSubmitting}>
                      {isSubmitting ? t("processing") : payLabel}
                    </Button>
                  </div>
                </SettingsField>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(method === "MTN_MOMO" ? "mtnPrompt" : "airtelPrompt")}
                </p>
              </>
            )}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
