"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatRwf } from "@/lib/format";
import { localized } from "@/lib/plans";
import type { ManagedPlan } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { RequirePermission } from "@/components/app/require-permission";
import { PlanFormDialog } from "@/components/app/plan-form-dialog";
import {
  DragHandle,
  REORDER_ROW_CLASSES,
  ReorderButtons,
  moveItem,
  useDragReorder,
} from "@/components/app/reorder";

function PlansContent() {
  const t = useTranslations("Plans");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const { token, can } = useAuth();
  const canCreate = can("plans.create");
  const canUpdate = can("plans.update");
  const canDelete = can("plans.delete");

  const { data, error, isLoading, refetch } = useApi<ManagedPlan[]>("/plans/manage");
  // Local copy so reordering is optimistic; replaced whenever the server list changes.
  const [plans, setPlans] = useState<ManagedPlan[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data) setPlans(data);
  }, [data]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedPlan | undefined>();
  const [statusTarget, setStatusTarget] = useState<ManagedPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedPlan | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const nameOf = (plan: ManagedPlan) => localized(plan.name, locale);

  async function move(from: number, to: number) {
    if (!token || from === to) return;
    const previous = plans;
    const next = moveItem(plans, from, to);
    setPlans(next);
    setAnnouncement(t("moved", { name: nameOf(previous[from]), position: to + 1, total: next.length }));
    setIsSavingOrder(true);
    try {
      const saved = await apiFetch<ManagedPlan[]>("/plans/order", {
        method: "PUT",
        token,
        body: { planIds: next.map((plan) => plan.id) },
      });
      setPlans(saved);
    } catch (err) {
      setPlans(previous);
      toast.error(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsSavingOrder(false);
    }
  }
  const { getItemProps, getHandleProps } = useDragReorder((from, to) => void move(from, to));

  async function toggleStatus() {
    if (!token || !statusTarget) return;
    try {
      await apiFetch(`/plans/${statusTarget.id}`, {
        method: "PATCH",
        token,
        body: { isActive: !statusTarget.isActive },
      });
      toast.success(statusTarget.isActive ? t("deactivated") : t("activated"));
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon("error"));
      throw err;
    }
  }

  async function handleDelete() {
    if (!token || !deleteTarget) return;
    try {
      await apiFetch(`/plans/${deleteTarget.id}`, { method: "DELETE", token });
      toast.success(t("deleted"));
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon("error"));
      throw err;
    }
  }

  const columns: DataTableColumn<ManagedPlan>[] = [];
  if (canUpdate) {
    columns.push({
      key: "order",
      header: t("order"),
      className: "w-28",
      cell: (plan) => {
        const index = plans.indexOf(plan);
        return (
          <span className="flex items-center gap-1">
            <DragHandle label={t("dragToReorder")} {...getHandleProps(index)} />
            <ReorderButtons
              index={index}
              count={plans.length}
              onMove={(from, to) => void move(from, to)}
              itemLabel={nameOf(plan)}
              disabled={isSavingOrder}
            />
          </span>
        );
      },
    });
  }
  columns.push(
    {
      key: "name",
      header: t("name"),
      cell: (plan) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{nameOf(plan)}</span>
          {plan.isMostPopular && (
            <span className="rounded-sm bg-primary/10 px-1.5 font-mono text-[8px] text-primary-text uppercase">
              {t("mostPopular")}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "price",
      header: t("price"),
      align: "right",
      className: "font-mono tabular-nums",
      cell: (plan) => formatRwf(plan.price),
    },
    {
      key: "type",
      header: t("accessType"),
      cell: (plan) => t(`accessTypes.${plan.accessType}`),
    },
    {
      key: "limit",
      header: t("limit"),
      className: "font-mono text-muted-foreground tabular-nums",
      cell: (plan) =>
        plan.accessType === "ATTEMPTS"
          ? t("attemptsLimit", { count: plan.attemptLimit ?? 0 })
          : t("daysLimit", { days: plan.durationDays ?? 0 }),
    },
    {
      key: "status",
      header: t("status"),
      cell: (plan) =>
        plan.isActive ? (
          <StatusBadge tone="success">{t("active")}</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">{t("inactive")}</StatusBadge>
        ),
    },
    {
      key: "purchases",
      header: t("purchases"),
      align: "right",
      className: "font-mono tabular-nums",
      cell: (plan) => plan._count.subscriptions,
    },
  );
  if (canUpdate || canDelete) {
    columns.push({
      key: "actions",
      header: tCommon("actions"),
      srOnlyHeader: true,
      align: "center",
      className: "w-16",
      cell: (plan) => (
        <RowActionsMenu
          rowLabel={nameOf(plan)}
          actions={[
            {
              key: "edit",
              label: tCommon("edit"),
              icon: Pencil,
              hidden: !canUpdate,
              onSelect: () => {
                setEditing(plan);
                setFormOpen(true);
              },
            },
            {
              key: "status",
              label: plan.isActive ? t("deactivate") : t("activate"),
              icon: Power,
              hidden: !canUpdate,
              onSelect: () => setStatusTarget(plan),
            },
            {
              key: "delete",
              group: 1,
              label: tCommon("delete"),
              icon: Trash2,
              destructive: true,
              hidden: !canDelete,
              // Plans with purchases are history — they can only be deactivated.
              disabledReason: plan._count.subscriptions > 0 ? t("cannotDelete") : undefined,
              onSelect: () => setDeleteTarget(plan),
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
            <Button
              className="btn-primary h-10 px-4"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              {t("newPlan")}
            </Button>
          )
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        {canUpdate && plans.length > 1 && <p className="text-sm text-muted-foreground">{t("reorderHint")}</p>}
        <DataTable
          columns={columns}
          rows={plans}
          getRowKey={(plan) => plan.id}
          isLoading={isLoading && plans.length === 0}
          caption={t("title")}
          emptyMessage={t("noPlans")}
          getRowProps={canUpdate ? (_, index) => getItemProps(index) : undefined}
          rowClassName={canUpdate ? REORDER_ROW_CLASSES : undefined}
        />
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </div>

      <PlanFormDialog open={formOpen} onOpenChange={setFormOpen} plan={editing} onSaved={refetch} />

      <ConfirmDialog
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        title={
          statusTarget?.isActive
            ? t("deactivateTitle", { name: statusTarget ? nameOf(statusTarget) : "" })
            : t("activateTitle", { name: statusTarget ? nameOf(statusTarget) : "" })
        }
        description={statusTarget?.isActive ? t("deactivateBody") : t("activateBody")}
        confirmLabel={statusTarget?.isActive ? t("deactivate") : t("activate")}
        destructive={statusTarget?.isActive}
        onConfirm={toggleStatus}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("deleteTitle", { name: deleteTarget ? nameOf(deleteTarget) : "" })}
        description={t("deleteBody")}
        confirmLabel={tCommon("delete")}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function PlansPage() {
  return (
    <RequirePermission anyOf={["plans.view"]}>
      <PlansContent />
    </RequirePermission>
  );
}
