"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { User } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const { user, token, refreshUser, can } = useAuth();
  // Without users.updateOwn the form is shown read-only (the backend would reject the save).
  const canEdit = can("users.updateOwn");

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Syncs local edit fields whenever the loaded profile changes (e.g. after a save).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFullName(user.fullName);
    setEmail(user.email ?? "");
    setPhone(user.phone);
  }, [user]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || !user) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await apiFetch<User>(`/users/${user.id}`, {
        method: "PUT",
        token,
        body: {
          fullName,
          phone,
          email: email.trim() ? email.trim() : undefined,
        },
      });
      await refreshUser();
      toast.success(t("profileUpdated"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <Avatar size="lg">
            <AvatarFallback className="text-base">{initials(user.fullName)}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>{user.fullName}</CardTitle>
            <CardDescription>
              {t("memberSince", { date: formatDate(user.createdAt, locale) })}
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">{t("fullName")}</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={!canEdit}
                required
                minLength={2}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={!canEdit}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={!canEdit}
              />
            </div>
          </CardContent>
          {canEdit && (
            <CardFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? tCommon("saving") : t("saveChanges")}
              </Button>
            </CardFooter>
          )}
        </form>
      </Card>
    </div>
  );
}
