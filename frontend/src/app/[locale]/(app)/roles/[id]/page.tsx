"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { PermissionCatalogModule, Role } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/page-header";
import { FULL_BLEED } from "@/components/app/settings-layout";
import { StatusBadge } from "@/components/app/status-badge";
import { PermissionMatrix } from "@/components/app/permission-matrix";
import { RoleFormDialog } from "@/components/app/role-form-dialog";
import { RequirePermission } from "@/components/app/require-permission";

function RoleContent() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("Roles");
  const tCommon = useTranslations("Common");
  const tAccess = useTranslations("Access");
  const { token, can } = useAuth();
  const canUpdate = can("roles.update");

  const { data: role, isLoading, error, refetch } = useApi<Role>(`/roles/${id}`);
  const { data: catalog } = useApi<PermissionCatalogModule[]>("/permissions/catalog");

  // Draft selection, reset whenever the saved role changes (load, save, refetch).
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [syncedRole, setSyncedRole] = useState<Role | null>(null);
  if (role && role !== syncedRole) {
    setSyncedRole(role);
    setDraft(new Set(role.permissions));
  }

  const [editOpen, setEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const saved = new Set(role?.permissions ?? []);
  const changes =
    [...draft].filter((name) => !saved.has(name)).length + [...saved].filter((name) => !draft.has(name)).length;
  // SuperAdmin bypasses every check: shown fully on and locked, never saved.
  const allNames = catalog?.flatMap((module) => module.actions.map((action) => action.name)) ?? [];
  const locked = !canUpdate || !!role?.isSuperAdmin;

  async function save() {
    if (!token || !role) return;
    setIsSaving(true);
    try {
      await apiFetch(`/roles/${role.id}`, { method: "PATCH", token, body: { permissions: [...draft] } });
      toast.success(t("permissionsSaved"));
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsSaving(false);
    }
  }

  if (error) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader backHref="/roles" title={t("title")} />
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        backHref="/roles"
        title={
          role ? (
            <span className="flex flex-wrap items-center gap-3">
              {role.name}
              {role.isSuperAdmin && <StatusBadge tone="success">{t("superAdmin")}</StatusBadge>}
              {role.isDefault && <StatusBadge tone="neutral">{t("default")}</StatusBadge>}
            </span>
          ) : (
            <Skeleton className="h-10 w-64" />
          )
        }
        subtitle={role ? role.description || t("noDescription") : undefined}
        action={
          role &&
          canUpdate && (
            <Button className="btn-tint h-10 px-4" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" aria-hidden />
              {t("editDetails")}
            </Button>
          )
        }
      />

      <div className="mt-8 bg-surface-muted py-8" style={FULL_BLEED}>
        <section
          aria-labelledby="permission-management-title"
          className="overflow-hidden rounded-lg border border-border bg-background"
        >
          <div className="flex flex-col gap-1 border-b border-border p-5 sm:p-7">
            <h2 id="permission-management-title" className="font-display text-xl font-medium">
              {t("permissionManagement")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("permissionManagementDescription")}</p>
          </div>

          <div className="flex flex-col gap-6 p-5 sm:p-7">
            {role?.isSuperAdmin && (
              <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                {t("superAdminNotice")}
              </p>
            )}
            {!canUpdate && !role?.isSuperAdmin && (
              <p className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
                {tAccess("viewOnly")}
              </p>
            )}

            {isLoading || !catalog || !role ? (
              <div className="flex flex-col gap-4">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <PermissionMatrix
                catalog={catalog}
                selected={role.isSuperAdmin ? new Set(allNames) : draft}
                onChange={setDraft}
                disabled={locked}
              />
            )}
          </div>

          {/* Save bar — sticks to the bottom of the viewport while there are unsaved changes. */}
          {!locked && role && (
            <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-surface-muted/95 px-5 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {changes > 0 ? t("unsavedChanges", { count: changes }) : t("allSaved")}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-10"
                  disabled={changes === 0 || isSaving}
                  onClick={() => setDraft(new Set(role.permissions))}
                >
                  {t("discard")}
                </Button>
                <Button className="btn-primary h-10 px-5" disabled={changes === 0 || isSaving} onClick={save}>
                  {isSaving ? tCommon("saving") : tCommon("saveChanges")}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      <RoleFormDialog open={editOpen} onOpenChange={setEditOpen} role={role ?? undefined} onSaved={() => refetch()} />
    </div>
  );
}

export default function RolePage() {
  return (
    <RequirePermission anyOf={["roles.view"]}>
      <RoleContent />
    </RequirePermission>
  );
}
