"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleCheck, Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthField } from "@/components/auth/auth-field";

/** Reset tokens are 32 random bytes, hex-encoded by the backend. */
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary so the rest of the route can prerender.
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const tCommon = useTranslations("Common");
  const token = useSearchParams().get("token") ?? "";
  const tokenLooksValid = TOKEN_PATTERN.test(token);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [linkRejected, setLinkRejected] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError(t("passwordsMismatch"));
      setLinkRejected(false);
      return;
    }
    setError(null);
    setLinkRejected(false);
    setIsSubmitting(true);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: { token, password },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("error"));
      // 400 here means the token was unknown, already used or expired.
      setLinkRejected(err instanceof ApiError && err.status === 400);
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

  if (done) {
    return (
      <AuthCard title={t("resetTitle")} subtitle={t("resetSuccess")} footer={footer}>
        <div className="flex flex-col items-center gap-4">
          <CircleCheck className="size-10 text-primary" />
          <Button
            className="btn-primary h-12 w-full text-sm"
            render={<Link href="/login" />}
            nativeButton={false}
          >
            {t("loginCta")}
          </Button>
        </div>
      </AuthCard>
    );
  }

  if (!tokenLooksValid) {
    return (
      <AuthCard title={t("resetTitle")} subtitle={t("resetSubtitle")} footer={footer}>
        <div className="flex flex-col gap-4">
          <Alert variant="destructive">
            <AlertDescription>{t("resetInvalidLink")}</AlertDescription>
          </Alert>
          <Button
            className="btn-primary h-12 w-full text-sm"
            render={<Link href="/forgot-password" />}
            nativeButton={false}
          >
            {t("requestNewLink")}
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("resetTitle")} subtitle={t("resetSubtitle")} footer={footer}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
              {linkRejected && (
                <>
                  {" "}
                  <Link href="/forgot-password" className="font-semibold underline">
                    {t("requestNewLink")}
                  </Link>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <AuthField
          id="password"
          icon={Lock}
          label={t("newPassword")}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t("passwordHint")}
          minLength={8}
          required
          autoFocus
        />

        <AuthField
          id="confirm-password"
          icon={Lock}
          label={t("confirmPassword")}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder={t("confirmPassword")}
          minLength={8}
          required
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary mt-3 h-12 w-full text-sm"
        >
          {isSubmitting ? t("resetting") : t("resetCta")}
        </Button>
      </form>
    </AuthCard>
  );
}
