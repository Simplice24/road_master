"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The role being edited; omit to create one. */
  role?: Role;
  /** Receives the saved role (the new one on create, so the caller can open its permissions). */
  onSaved: (role: Role, created: boolean) => void;
}

/** Name + description only. Permissions are managed on the role's own page (/roles/[id]). */
export function RoleFormDialog(props: RoleFormDialogProps) {
  // Remount per role/open so the form always starts from the row being edited.
  return props.open ? <RoleForm key={props.role?.id ?? "new"} {...props} /> : null;
}

function RoleForm({ open, onOpenChange, role, onSaved }: RoleFormDialogProps) {
  const t = useTranslations("Roles");
  const tCommon = useTranslations("Common");
  const { token } = useAuth();
  const isEdit = !!role;

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setIsSubmitting(true);
    const body = { name: name.trim(), description: description.trim() };
    try {
      const saved = isEdit
        ? await apiFetch<Role>(`/roles/${role.id}`, { method: "PATCH", token, body })
        : await apiFetch<Role>("/roles", { method: "POST", token, body });
      toast.success(isEdit ? t("updated") : t("created"));
      onOpenChange(false);
      onSaved(saved, !isEdit);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-medium">
              {isEdit ? t("editTitle") : t("createTitle")}
            </DialogTitle>
            <DialogDescription>{isEdit ? t("editDescription") : t("createDescription")}</DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">{t("name")}</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-description">{t("description")}</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" className="btn-primary" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? tCommon("saving") : isEdit ? tCommon("save") : t("createAndContinue")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
