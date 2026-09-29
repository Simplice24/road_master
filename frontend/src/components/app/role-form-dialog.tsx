"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { PermissionCatalogModule, Role } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
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
  /** From GET /permissions/catalog; null while loading. */
  catalog: PermissionCatalogModule[] | null;
  onSaved: () => void;
}

export function RoleFormDialog(props: RoleFormDialogProps) {
  // Remount per role/open so the form always starts from the row being edited.
  return props.open ? <RoleForm key={props.role?.id ?? "new"} {...props} /> : null;
}

/** Translated module/action label, falling back to the backend catalog's English label so a
 * permission added to the backend config shows up before its translation exists. */
function usePermissionLabels() {
  const t = useTranslations("PermissionCatalog");
  return {
    module: (module: PermissionCatalogModule) =>
      t.has(`modules.${module.module}`) ? t(`modules.${module.module}`) : module.label,
    action: (module: string, action: { action: string; label: string }) =>
      t.has(`actions.${module}.${action.action}`) ? t(`actions.${module}.${action.action}`) : action.label,
  };
}

function RoleForm({ open, onOpenChange, role, catalog, onSaved }: RoleFormDialogProps) {
  const t = useTranslations("Roles");
  const tCommon = useTranslations("Common");
  const { token } = useAuth();
  const labels = usePermissionLabels();
  const isEdit = !!role;
  const isSuperAdmin = !!role?.isSuperAdmin;

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function setMany(names: string[], checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const permission of names) {
        if (checked) next.add(permission);
        else next.delete(permission);
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setIsSubmitting(true);
    const body = {
      name: name.trim(),
      description: description.trim(),
      // The SuperAdmin role bypasses all checks and the API rejects a permission list for it.
      ...(isSuperAdmin ? {} : { permissions: [...selected] }),
    };
    try {
      if (isEdit) {
        await apiFetch(`/roles/${role.id}`, { method: "PATCH", token, body });
        toast.success(t("updated"));
      } else {
        await apiFetch("/roles", { method: "POST", token, body });
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

  const total = catalog?.reduce((sum, module) => sum + module.actions.length, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-medium">
              {isEdit ? t("editTitle") : t("createTitle")}
            </DialogTitle>
            <DialogDescription>{t("formDescription")}</DialogDescription>
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
              rows={2}
            />
          </div>

          {isSuperAdmin ? (
            <p className="rounded-lg border border-success/40 bg-success/10 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-200">
              {t("superAdminNotice")}
            </p>
          ) : (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 flex w-full items-baseline justify-between text-sm font-medium">
                {t("permissions")}
                {catalog && (
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    {t("permissionsCount", { count: selected.size, total })}
                  </span>
                )}
              </legend>

              {!catalog && <Skeleton className="h-48 w-full" />}

              {catalog?.map((module) => {
                const names = module.actions.map((action) => action.name);
                const checkedCount = names.filter((permission) => selected.has(permission)).length;
                const allChecked = checkedCount === names.length;
                const moduleLabel = labels.module(module);
                return (
                  <div key={module.module} className="overflow-hidden rounded-lg border border-border">
                    <label className="flex items-center gap-2.5 border-b border-border bg-surface-muted px-3 py-2">
                      <Checkbox
                        checked={allChecked}
                        indeterminate={checkedCount > 0 && !allChecked}
                        onCheckedChange={(checked) => setMany(names, checked)}
                        aria-label={t("selectAllIn", { module: moduleLabel })}
                      />
                      <span className="flex-1 font-mono text-xs font-medium tracking-wider text-foreground/75 uppercase">
                        {moduleLabel}
                      </span>
                      <span className="text-xs text-muted-foreground">{t("selectAll")}</span>
                    </label>
                    <div className="grid gap-x-4 gap-y-1 p-2 sm:grid-cols-2">
                      {module.actions.map((action) => (
                        <label
                          key={action.name}
                          className="flex items-center gap-2.5 rounded-sm px-1.5 py-1.5 text-sm hover:bg-surface-muted"
                        >
                          <Checkbox
                            checked={selected.has(action.name)}
                            onCheckedChange={(checked) => setMany([action.name], checked)}
                          />
                          <span className="flex-1">{labels.action(module.module, action)}</span>
                          <code className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
                            {action.action}
                          </code>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </fieldset>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" className="btn-primary" disabled={isSubmitting || (!isSuperAdmin && !catalog)}>
              {isSubmitting ? tCommon("saving") : isEdit ? tCommon("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
