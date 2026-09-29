"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { User, Phone, Mail, Lock } from "lucide-react";
import { useRouter, Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthField } from "@/components/auth/auth-field";

export default function RegisterPage() {
  const t = useTranslations("Auth");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const { register } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register({
        fullName,
        phone,
        password,
        email: email.trim() ? email.trim() : undefined,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      title={t("registerTitle")}
      subtitle={t("registerSubtitle")}
      footer={
        <>
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-semibold text-foreground hover:underline">
            {t("loginLink")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AuthField
          id="fullName"
          icon={User}
          label={t("fullName")}
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder={t("fullNamePlaceholder")}
          required
          minLength={2}
          autoFocus
        />

        <AuthField
          id="phone"
          icon={Phone}
          label={t("phone")}
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder={t("phonePlaceholder")}
          required
        />

        <AuthField
          id="email"
          icon={Mail}
          label={t("emailOptional")}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t("emailOptional")}
        />

        <div className="flex flex-col gap-1">
          <AuthField
            id="password"
            icon={Lock}
            label={t("password")}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("password")}
            minLength={8}
            required
          />
          <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary mt-3 h-12 w-full text-sm"
        >
          {isSubmitting ? t("registering") : t("registerCta")}
        </Button>
      </form>
    </AuthCard>
  );
}
