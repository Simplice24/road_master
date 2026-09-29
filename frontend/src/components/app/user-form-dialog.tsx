"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { ManagedUser, Role } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The user being edited; omit to create a new one. */
  user?: ManagedUser;
  /** Assignable roles, or null when the caller can't list/assign roles (field hidden). */
  roles: Role[] | null;
  onSaved: () => void;
}

/** Mirrors backend CreateUserDto / UpdateUserDto limits. */
const LIMITS = { fullName: [2, 100], phone: [1, 32], password: [8, 72] } as const;

export function UserFormDialog(props: UserFormDialogProps) {
  // Remount per user/open so the form always starts from the row being edited.
  return props.open ? <UserForm key={props.user?.id ?? "new"} {...props} /> : null;
}

function UserForm({ open, onOpenChange, user, roles, onSaved }: UserFormDialogProps) {
  const t = useTranslations("Users");
  const tCommon = useTranslations("Common");
  const { token, can, user: me } = useAuth();
  const isEdit = !!user;
  // Editing profile fields needs users.update; role changes need roles.assign (checked by the
  // parent via `roles`). Someone with only roles.assign sees the profile fields read-only.
  const canEditProfile = isEdit ? can("users.update") : can("users.create");

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const initialRoleIds = user?.roles.map((role) => role.id) ?? [];
  const [roleIds, setRoleIds] = useState<string[]>(initialRoleIds);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleRole(roleId: string, checked: boolean) {
    setRoleIds((current) =>
      checked ? [...current, roleId] : current.filter((id) => id !== roleId),
    );
  }

  const rolesChanged =
    roleIds.length !== initialRoleIds.length ||
    roleIds.some((id) => !initialRoleIds.includes(id));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setIsSubmitting(true);
    const profile = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() ? email.trim() : undefined,
    };
    try {
      if (isEdit) {
        if (canEditProfile) {
          await apiFetch(`/users/${user.id}`, { method: "PUT", token, body: profile });
        }
        if (roles && rolesChanged) {
          await apiFetch(`/users/${user.id}/roles`, { method: "PUT", token, body: { roleIds } });
        }
        toast.success(t("updated"));
      } else {
        await apiFetch("/users", {
          method: "POST",
          token,
          body: {
            ...profile,
            password,
            isActive,
            roleIds: roles && roleIds.length > 0 ? roleIds : undefined,
          },
        });
        toast.success(t("created"));
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-medium">
              {isEdit ? t("editTitle") : t("createTitle")}
            </DialogTitle>
            <DialogDescription>{isEdit ? user.fullName : t("createDescription")}</DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="user-fullName">{t("name")}</Label>
              <Input
                id="user-fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                minLength={LIMITS.fullName[0]}
                maxLength={LIMITS.fullName[1]}
                disabled={!canEditProfile}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-phone">{t("phone")}</Label>
              <Input
                id="user-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                minLength={LIMITS.phone[0]}
                maxLength={LIMITS.phone[1]}
                disabled={!canEditProfile}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-email">{t("email")}</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={!canEditProfile}
              />
            </div>
            {!isEdit && (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="user-password">{t("password")}</Label>
                <Input
                  id="user-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={LIMITS.password[0]}
                  maxLength={LIMITS.password[1]}
                  aria-describedby="user-password-hint"
                  required
                />
                <p id="user-password-hint" className="text-xs text-muted-foreground">
                  {t("passwordHint")}
                </p>
              </div>
            )}
          </div>

          {roles && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t("roles")}</legend>
              {!isEdit && <p className="text-xs text-muted-foreground">{t("rolesHint")}</p>}
              <div className="grid gap-1 rounded-lg border border-border p-2 sm:grid-cols-2">
                {roles.map((role) => {
                  // Only a SuperAdmin can grant or revoke the SuperAdmin role (backend-enforced).
                  const locked = role.isSuperAdmin && !me?.isSuperAdmin;
                  return (
                    <label
                      key={role.id}
                      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-surface-muted has-disabled:cursor-not-allowed has-disabled:opacity-60"
                      title={locked ? t("superAdminRoleLocked") : undefined}
                    >
                      <Checkbox
                        checked={roleIds.includes(role.id)}
                        onCheckedChange={(checked) => toggleRole(role.id, checked)}
                        disabled={locked}
                      />
                      <span className="truncate">{role.name}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {!isEdit && (
            <label className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
              <span className="text-sm font-medium">{t("activeLabel")}</span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </label>
          )}

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
