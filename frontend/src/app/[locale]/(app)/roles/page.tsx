"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { PermissionCatalogModule, Role } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { RoleFormDialog } from "@/components/app/role-form-dialog";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { RequirePermission } from "@/components/app/require-permission";

function RolesContent() {
  const t = useTranslations("Roles");
  const tCommon = useTranslations("Common");
  const { token, can } = useAuth();

  const canCreate = can("roles.create");
  const canUpdate = can("roles.update");
  const canDelete = can("roles.delete");

  const { data: roles, isLoading, refetch } = useApi<Role[]>("/roles");
  const { data: catalog } = useApi<PermissionCatalogModule[]>("/permissions/catalog");
  const total = catalog?.reduce((sum, module) => sum + module.actions.length, 0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Role | undefined>();
  const [deleting, setDeleting] = useState<Role | null>(null);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!token || !deleting) return;
    try {
      await apiFetch(`/roles/${deleting.id}`, { method: "DELETE", token });
      toast.success(t("deleted"));
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon("error"));
      throw err;
    }
  }

  const columns: DataTableColumn<Role>[] = [
    {
      key: "name",
      header: t("name"),
      cell: (role) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{role.name}</span>
          {role.isSuperAdmin && <StatusBadge tone="success">{t("superAdmin")}</StatusBadge>}
          {role.isDefault && <StatusBadge tone="neutral">{t("default")}</StatusBadge>}
        </span>
      ),
    },
    {
      key: "description",
      header: t("description"),
      className: "max-w-xs truncate whitespace-nowrap text-muted-foreground",
      cell: (role) => role.description || "—",
    },
    {
      key: "permissions",
      header: t("permissions"),
      className: "font-mono tabular-nums text-muted-foreground",
      cell: (role) =>
        role.isSuperAdmin
          ? t("allPermissions")
          : total !== undefined
            ? t("permissionsCount", { count: role.permissions.length, total })
            : role.permissions.length,
    },
    {
      key: "users",
      header: t("users"),
      align: "right",
      className: "font-mono tabular-nums text-muted-foreground",
      cell: (role) => role.userCount,
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      key: "actions",
      header: tCommon("actions"),
      srOnlyHeader: true,
      align: "center",
      className: "w-16",
      cell: (role) => (
        <RowActionsMenu
          rowLabel={role.name}
          actions={[
            {
              key: "edit",
              label: tCommon("edit"),
              icon: Pencil,
              hidden: !canUpdate,
              onSelect: () => {
                setEditing(role);
                setFormOpen(true);
              },
            },
            {
              key: "delete",
              group: 1,
              label: tCommon("delete"),
              icon: Trash2,
              destructive: true,
              hidden: !canDelete,
              // The backend refuses both; the menu says why instead of letting the click fail.
              disabledReason: role.isSuperAdmin
                ? t("cannotDeleteSuperAdmin")
                : role.isDefault
                  ? t("cannotDeleteDefault")
                  : undefined,
              onSelect: () => setDeleting(role),
            },
          ]}
        />
      ),
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        backHref="/dashboard"
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          canCreate && (
            <Button className="btn-primary h-10 px-4" onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              {t("newRole")}
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        rows={roles ?? []}
        getRowKey={(role) => role.id}
        isLoading={isLoading}
        caption={t("title")}
        emptyMessage={t("noRoles")}
      />

      <RoleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        role={editing}
        catalog={catalog}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("deleteTitle", { name: deleting?.name ?? "" })}
        description={t("deleteBody", { count: deleting?.userCount ?? 0 })}
        confirmLabel={tCommon("delete")}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function RolesPage() {
  return (
    <RequirePermission anyOf={["roles.view"]}>
      <RolesContent />
    </RequirePermission>
  );
}
