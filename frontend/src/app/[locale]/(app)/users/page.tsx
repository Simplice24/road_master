"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Power, Search, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate, formatRwf } from "@/lib/format";
import type { ManagedUser, Paginated, Role } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { Pagination } from "@/components/app/pagination";
import { StatusBadge } from "@/components/app/status-badge";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { UserFormDialog } from "@/components/app/user-form-dialog";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { RequirePermission } from "@/components/app/require-permission";
import { AdjustBalanceDialog } from "@/components/app/adjust-balance-dialog";

const PAGE_SIZE = 20;
const ALL = "all";
const NO_ROLE = "none";

function UsersContent() {
  const t = useTranslations("Users");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const { user: me, token, can } = useAuth();

  const canCreate = can("users.create");
  const canUpdate = can("users.update");
  // Role checkboxes need both the list of roles and the right to assign them.
  const canAssignRoles = can("roles.assign") && can("roles.view");
  const canViewRoles = can("roles.view");
  const canViewBalances = can("transactions.view");
  const canAdjust = can("transactions.adjust");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | undefined>();
  const [statusTarget, setStatusTarget] = useState<ManagedUser | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<ManagedUser | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleId, setRoleId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);

  // Server-side search: wait for typing to pause, and go back to page 1 on any filter change.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (debouncedSearch) query.set("search", debouncedSearch);
  if (roleId !== ALL) query.set("roleId", roleId);
  if (status !== ALL) query.set("status", status);
  const { data, error, isLoading, refetch } = useApi<Paginated<ManagedUser>>(`/users?${query}`);
  // One page of 100 (the API's max) covers every role in practice — needed for the filter and
  // the form's role checkboxes.
  const { data: roles } = useApi<Paginated<Role>>(canViewRoles ? "/roles?pageSize=100" : null);

  const roleOptions = useMemo(
    () => [
      { value: ALL, label: t("allRoles") },
      ...(roles?.items ?? []).map((role) => ({ value: role.id, label: role.name })),
      { value: NO_ROLE, label: t("noRole") },
    ],
    [roles, t],
  );
  const statusOptions = [
    { value: ALL, label: t("anyStatus") },
    { value: "active", label: t("active") },
    { value: "inactive", label: t("inactive") },
  ];
  const filtered = !!debouncedSearch || roleId !== ALL || status !== ALL;

  function filterSetter(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  }

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
            <span className="rounded-sm bg-primary/10 px-1.5 font-mono text-[8px] text-primary-text uppercase">
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
    ...(canViewBalances
      ? [
          {
            key: "balance",
            header: t("balance"),
            align: "right" as const,
            className: "font-mono tabular-nums",
            cell: (user: ManagedUser) => formatRwf(user.walletBalance),
          },
        ]
      : []),
    {
      key: "created",
      header: t("createdAt"),
      className: "text-muted-foreground",
      cell: (user) => formatDate(user.createdAt, locale),
    },
  ];

  if (canUpdate || canAssignRoles || canAdjust) {
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
            {
              key: "edit",
              label: tCommon("edit"),
              icon: Pencil,
              onSelect: () => openEdit(user),
              hidden: !canUpdate && !canAssignRoles,
            },
            {
              key: "adjust",
              label: t("adjustBalance"),
              icon: Wallet,
              onSelect: () => setAdjustTarget(user),
              // Nobody adjusts their own wallet (backend-enforced too).
              hidden: !canAdjust || user.id === me?.id,
            },
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
        backHref="/dashboard"
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

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4">
        <div
          className={
            canViewRoles
              ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_14rem_10rem]"
              : "grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]"
          }
        >
          <div className="relative">
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
          {canViewRoles && (
            <SearchableSelect
              value={roleId}
              onValueChange={filterSetter(setRoleId)}
              options={roleOptions}
              aria-label={t("roles")}
              searchPlaceholder={tCommon("search")}
              emptyText={tCommon("noMatches")}
              className="h-10"
            />
          )}
          <SearchableSelect
            value={status}
            onValueChange={filterSetter(setStatus)}
            options={statusOptions}
            aria-label={t("status")}
            searchPlaceholder={tCommon("search")}
            emptyText={tCommon("noMatches")}
            className="h-10"
          />
        </div>

        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          getRowKey={(user) => user.id}
          isLoading={isLoading}
          loadingRows={6}
          caption={t("title")}
          emptyMessage={filtered ? tCommon("noMatches") : t("noUsers")}
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

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editing}
        roles={canAssignRoles ? (roles?.items ?? []) : null}
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

      {adjustTarget && (
        <AdjustBalanceDialog user={adjustTarget} onClose={() => setAdjustTarget(null)} onSaved={refetch} />
      )}
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
