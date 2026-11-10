"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Mail, MailCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthField } from "@/components/auth/auth-field";

export default function ForgotPasswordPage() {
  const t = useTranslations("Auth");
  const tCommon = useTranslations("Common");
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      // The backend answers the same way whether or not the email is registered.
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim(), locale },
      });
      setSentTo(email.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const footer = (
    <>
      {t("rememberPassword")}{" "}
      <Link href="/login" className="font-semibold text-foreground hover:underline">
        {t("loginLink")}
      </Link>
    </>
  );

  if (sentTo) {
    return (
      <AuthCard title={t("forgotSentTitle")} subtitle={t("forgotSent", { email: sentTo })} footer={footer}>
        <div className="flex flex-col items-center gap-4">
          <MailCheck className="size-10 text-primary" />
          <Button
            variant="outline"
            className="h-11 w-full text-sm"
            onClick={() => {
              setSentTo(null);
              setEmail("");
            }}
          >
            {t("resendLink")}
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("forgotTitle")} subtitle={t("forgotSubtitle")} footer={footer}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AuthField
          id="email"
          icon={Mail}
          label={t("email")}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t("emailPlaceholder")}
          required
          autoFocus
        />

        <p className="text-xs text-muted-foreground">{t("forgotNoEmailHint")}</p>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary mt-3 h-12 w-full text-sm"
        >
          {isSubmitting ? t("sendingLink") : t("forgotCta")}
        </Button>
      </form>
    </AuthCard>
  );
}
