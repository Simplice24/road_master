"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/app/status-badge";
import { FULL_BLEED, SettingsField, SettingsSection } from "@/components/app/settings-layout";

// Mirrors backend UpdateUserDto (fullName MinLength 2) and CreateUserDto (≤100 chars, phone ≤32).
const LIMITS = { fullName: { min: 2, max: 100 }, phoneMax: 32 } as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function initials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function ProfilePage() {
  const t = useTranslations("Profile");
  const tAccess = useTranslations("Access");
  const locale = useLocale();
  const { user, token, refreshUser, can } = useAuth();
  // Without users.updateOwn every field is read-only (the backend would reject the save anyway).
  const canEdit = can("users.updateOwn");

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  // Keep the drafts in step with the signed-in user (e.g. after a save refreshes it).
  const [syncedUser, setSyncedUser] = useState(user);
  if (user && user !== syncedUser) {
    setSyncedUser(user);
    setFullName(user.fullName);
    setPhone(user.phone);
    setEmail(user.email ?? "");
  }

  if (!user) return null;

  const trimmedName = fullName.trim();
  const nameError =
    trimmedName.length < LIMITS.fullName.min || trimmedName.length > LIMITS.fullName.max
      ? t("errors.nameLength", LIMITS.fullName)
      : undefined;
  const phoneError = !phone.trim()
    ? t("errors.phoneRequired")
    : phone.trim().length > LIMITS.phoneMax
      ? t("errors.phoneLength", { max: LIMITS.phoneMax })
      : undefined;
  const emailError = email.trim() && !EMAIL_PATTERN.test(email.trim()) ? t("errors.emailInvalid") : undefined;

  async function save(body: Record<string, string | null>) {
    if (!token || !user) return;
    await apiFetch(`/users/${user.id}`, { method: "PUT", token, body });
    // Refresh the shared user so the new name/phone shows everywhere (top bar, menus) at once.
    await refreshUser();
    toast.success(t("profileUpdated"));
  }

  return (
    <div className="flex flex-col">
      <Link
        href="/dashboard"
        className="flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <h1 className="mt-4 font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
        {t("title")}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {t("memberSince", { date: formatDate(user.createdAt, locale) })}
      </p>

      <div className="mt-8 bg-surface-muted py-8" style={FULL_BLEED}>
        {!canEdit && (
          <p className="mb-6 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
            {tAccess("viewOnly")}
          </p>
        )}

        <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-8">
          <nav aria-label={t("sectionsNav")}>
            <ul className="flex flex-col border-l border-border">
              <li>
                <span
                  aria-current="true"
                  className="-ml-px flex border-l-2 border-primary bg-primary/10 px-4 py-2.5 font-mono text-sm tracking-wide text-primary-text uppercase"
                >
                  {t("general")}
                </span>
              </li>
            </ul>
          </nav>

          <div className="flex min-w-0 flex-col gap-6">
            <SettingsSection
              title={t("avatarTitle")}
              description={t("avatarDescription")}
              hint={t("avatarHint")}
              aside={
                <Avatar className="size-20 shrink-0">
                  <AvatarFallback className="bg-primary/10 font-display text-2xl text-primary-text">
                    {initials(user.fullName)}
                  </AvatarFallback>
                </Avatar>
              }
            />

            <SettingsSection
              title={t("nameTitle")}
              description={t("nameDescription")}
              hint={t("nameHint", { max: LIMITS.fullName.max })}
              readOnly={!canEdit}
              dirty={trimmedName !== user.fullName}
              valid={!nameError}
              onSave={() => save({ fullName: trimmedName })}
            >
              <SettingsField id="profile-name" label={t("fullName")} error={nameError}>
                <Input
                  id="profile-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  maxLength={LIMITS.fullName.max}
                  disabled={!canEdit}
                  aria-invalid={!!nameError}
                  aria-describedby={nameError ? "profile-name-error" : undefined}
                  autoComplete="name"
                  className="max-w-md"
                />
              </SettingsField>
            </SettingsSection>

            <SettingsSection
              title={t("contactTitle")}
              description={t("contactDescription")}
              hint={t("contactHint")}
              readOnly={!canEdit}
              dirty={phone.trim() !== user.phone || email.trim() !== (user.email ?? "")}
              valid={!phoneError && !emailError}
              // An emptied email is sent as null so it's cleared rather than rejected as invalid.
              onSave={() => save({ phone: phone.trim(), email: email.trim() || null })}
            >
              <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
                <SettingsField id="profile-phone" label={t("phone")} error={phoneError}>
                  <Input
                    id="profile-phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    maxLength={LIMITS.phoneMax}
                    disabled={!canEdit}
                    aria-invalid={!!phoneError}
                    aria-describedby={phoneError ? "profile-phone-error" : undefined}
                    autoComplete="tel"
                  />
                </SettingsField>
                <SettingsField id="profile-email" label={t("emailOptional")} error={emailError}>
                  <Input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={!canEdit}
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? "profile-email-error" : undefined}
                    autoComplete="email"
                  />
                </SettingsField>
              </div>
            </SettingsSection>

            <SettingsSection title={t("rolesTitle")} description={t("rolesDescription")} hint={t("rolesHint")}>
              {user.roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noRoles")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {user.roles.map((role) => (
                    <StatusBadge key={role.id} tone={role.isSuperAdmin ? "success" : "neutral"} className="normal-case">
                      {role.name}
                    </StatusBadge>
                  ))}
                </div>
              )}
            </SettingsSection>
          </div>
        </div>
      </div>
    </div>
  );
}
