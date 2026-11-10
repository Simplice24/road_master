"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Search, ToggleRight, Trash2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Paginated, PermissionCatalogModule, Role } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { Pagination } from "@/components/app/pagination";
import { StatusBadge } from "@/components/app/status-badge";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { RoleFormDialog } from "@/components/app/role-form-dialog";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { RequirePermission } from "@/components/app/require-permission";

const PAGE_SIZE = 20;

function RolesContent() {
  const t = useTranslations("Roles");
  const tCommon = useTranslations("Common");
  const { token, can } = useAuth();
  const router = useRouter();

  const canCreate = can("roles.create");
  const canUpdate = can("roles.update");
  const canDelete = can("roles.delete");

  const { data: catalog } = useApi<PermissionCatalogModule[]>("/permissions/catalog");
  const total = catalog?.reduce((sum, module) => sum + module.actions.length, 0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Role | undefined>();
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Server-side, name-only search: wait for typing to pause, and go back to page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (debouncedSearch) query.set("search", debouncedSearch);
  const { data, error, isLoading, refetch } = useApi<Paginated<Role>>(`/roles?${query}`);

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
          <Link
            href={`/roles/${role.id}`}
            className="rounded-sm font-medium text-foreground hover:text-primary-text hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {role.name}
          </Link>
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

  // Always present: everyone who can see this page can open a role's permissions (read-only
  // without roles.update).
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
            key: "permissions",
            label: t("managePermissions"),
            icon: ToggleRight,
            href: `/roles/${role.id}`,
          },
          {
            key: "edit",
            label: t("editDetails"),
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

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4">
        <div className="relative w-full sm:max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="h-10 bg-background pl-9"
          />
        </div>
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          getRowKey={(role) => role.id}
          isLoading={isLoading}
          caption={t("title")}
          emptyMessage={debouncedSearch ? tCommon("noMatches") : t("noRoles")}
        />
        {data && (
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={setPage}
            disabled={isLoading}
          />
        )}
      </div>

      <RoleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        role={editing}
        onSaved={(role, created) => (created ? router.push(`/roles/${role.id}`) : refetch())}
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
