"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Power } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { ManagedUser, Role } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { UserFormDialog } from "@/components/app/user-form-dialog";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { RequirePermission } from "@/components/app/require-permission";

function UsersContent() {
  const t = useTranslations("Users");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const { user: me, token, can } = useAuth();

  const canCreate = can("users.create");
  const canUpdate = can("users.update");
  // Role checkboxes need both the list of roles and the right to assign them.
  const canAssignRoles = can("roles.assign") && can("roles.view");

  const { data: users, isLoading, refetch } = useApi<ManagedUser[]>("/users");
  const { data: roles } = useApi<Role[]>(canAssignRoles ? "/roles" : null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | undefined>();
  const [statusTarget, setStatusTarget] = useState<ManagedUser | null>(null);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(user: ManagedUser) {
    setEditing(user);
    setFormOpen(true);
  }

  async function toggleStatus() {
    if (!token || !statusTarget) return;
    try {
      await apiFetch(`/users/${statusTarget.id}/status`, {
        method: "PATCH",
        token,
        body: { isActive: !statusTarget.isActive },
      });
      toast.success(t("statusUpdated"));
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon("error"));
      throw err;
    }
  }

  const columns: DataTableColumn<ManagedUser>[] = [
    {
      key: "name",
      header: t("name"),
      cell: (user) => (
        <span className="flex items-center gap-2">
          {user.fullName}
          {user.id === me?.id && (
            <span className="rounded-sm bg-primary/10 px-1.5 font-mono text-[10px] text-primary-text uppercase">
              {t("you")}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "phone",
      header: t("phone"),
      className: "font-mono text-muted-foreground",
      cell: (user) => user.phone,
    },
    {
      key: "roles",
      header: t("roles"),
      cell: (user) =>
        user.roles.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {user.roles.map((role) => (
              <StatusBadge key={role.id} tone={role.isSuperAdmin ? "success" : "neutral"} className="normal-case">
                {role.name}
              </StatusBadge>
            ))}
          </span>
        ),
    },
    {
      key: "status",
      header: t("status"),
      cell: (user) =>
        user.isActive ? (
          <StatusBadge tone="success">{t("active")}</StatusBadge>
        ) : (
          <StatusBadge tone="danger">{t("inactive")}</StatusBadge>
        ),
    },
    {
      key: "created",
      header: t("createdAt"),
      className: "text-muted-foreground",
      cell: (user) => formatDate(user.createdAt, locale),
    },
  ];

  if (canUpdate || canAssignRoles) {
    columns.push({
      key: "actions",
      header: tCommon("actions"),
      srOnlyHeader: true,
      align: "center",
      className: "w-16",
      cell: (user) => (
        <RowActionsMenu
          rowLabel={user.fullName}
          actions={[
            { key: "edit", label: tCommon("edit"), icon: Pencil, onSelect: () => openEdit(user) },
            {
              key: "status",
              group: 1,
              label: user.isActive ? t("deactivate") : t("activate"),
              icon: Power,
              destructive: user.isActive,
              onSelect: () => setStatusTarget(user),
              // Nobody changes their own status (backend-enforced too).
              hidden: !canUpdate || user.id === me?.id,
            },
          ]}
        />
      ),
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          canCreate && (
            <Button className="btn-primary h-10 px-4" onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              {t("newUser")}
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        rows={users ?? []}
        getRowKey={(user) => user.id}
        isLoading={isLoading}
        caption={t("title")}
        emptyMessage={t("noUsers")}
      />

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editing}
        roles={canAssignRoles ? (roles ?? []) : null}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        title={
          statusTarget?.isActive
            ? t("deactivateTitle", { name: statusTarget.fullName })
            : t("activateTitle", { name: statusTarget?.fullName ?? "" })
        }
        description={statusTarget?.isActive ? t("deactivateBody") : t("activateBody")}
        confirmLabel={statusTarget?.isActive ? t("deactivate") : t("activate")}
        destructive={statusTarget?.isActive}
        onConfirm={toggleStatus}
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <RequirePermission anyOf={["users.view"]}>
      <UsersContent />
    </RequirePermission>
  );
}
