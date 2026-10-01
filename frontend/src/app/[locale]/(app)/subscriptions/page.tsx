"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarPlus, Ban, Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { formatDate, formatDateTime, formatRwf } from "@/lib/format";
import type { UserSubscription } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { RequirePermission } from "@/components/app/require-permission";
import { SubscriptionStatusBadge } from "@/components/app/record-status";
import { useSubscriptionName } from "@/components/app/access-status";
import {
  ExtendSubscriptionDialog,
  GrantSubscriptionDialog,
  RevokeSubscriptionDialog,
} from "@/components/app/subscription-dialogs";

function SubscriptionsContent() {
  const t = useTranslations("Subscriptions");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const { can } = useAuth();
  const canUpdate = can("subscriptions.update");
  // Granting needs someone to grant to — the user picker loads /users.
  const canGrant = can("subscriptions.grant") && can("users.view");
  const nameOf = useSubscriptionName();

  const { data, error, isLoading, refetch } = useApi<UserSubscription[]>("/subscriptions");
  const [query, setQuery] = useState("");
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<UserSubscription | null>(null);
  const [extending, setExtending] = useState<UserSubscription | null>(null);

  const needle = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (row) =>
          !needle ||
          row.user.fullName.toLowerCase().includes(needle) ||
          row.user.phone.includes(needle) ||
          nameOf(row).toLowerCase().includes(needle),
      ),
    [data, needle, nameOf],
  );

  const columns: DataTableColumn<UserSubscription>[] = [
    {
      key: "user",
      header: t("user"),
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.user.fullName}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.user.phone}</span>
        </span>
      ),
    },
    {
      key: "plan",
      header: t("plan"),
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-medium">{nameOf(row)}</span>
          <span className="text-xs text-muted-foreground">{t(`sources.${row.source}`)}</span>
        </span>
      ),
    },
    {
      key: "terms",
      header: t("terms"),
      className: "font-mono text-xs text-muted-foreground tabular-nums",
      cell: (row) =>
        row.accessType === "ATTEMPTS"
          ? t("attemptsRemaining", { remaining: row.attemptsRemaining ?? 0, total: row.attemptLimit ?? 0 })
          : row.expiresAt
            ? `${formatDateTime(row.startsAt, locale)} → ${formatDateTime(row.expiresAt, locale)}`
            : "—",
    },
    {
      key: "status",
      header: t("status"),
      cell: (row) => <SubscriptionStatusBadge status={row.status} isQueued={row.isQueued} />,
    },
    {
      key: "price",
      header: t("price"),
      align: "right",
      className: "font-mono tabular-nums",
      cell: (row) => formatRwf(row.price),
    },
    {
      key: "created",
      header: t("createdAt"),
      className: "text-muted-foreground",
      cell: (row) => formatDate(row.createdAt, locale),
    },
  ];
  if (canUpdate) {
    columns.push({
      key: "actions",
      header: tCommon("actions"),
      srOnlyHeader: true,
      align: "center",
      className: "w-16",
      cell: (row) => {
        const closed = row.status === "CANCELLED" || row.status === "PENDING";
        const expired = row.accessType === "TIME" && row.status === "EXPIRED";
        return (
          <RowActionsMenu
            rowLabel={`${row.user.fullName} — ${nameOf(row)}`}
            actions={[
              {
                key: "extend",
                label: t("extend"),
                icon: CalendarPlus,
                disabledReason: closed ? t("notUsable") : expired ? t("expiredUseGrant") : undefined,
                onSelect: () => setExtending(row),
              },
              {
                key: "revoke",
                group: 1,
                label: t("revoke"),
                icon: Ban,
                destructive: true,
                disabledReason: row.status === "CANCELLED" ? t("alreadyRevoked") : undefined,
                onSelect: () => setRevoking(row),
              },
            ]}
          />
        );
      },
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        backHref="/dashboard"
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          canGrant && (
            <Button className="btn-primary h-10 px-4" onClick={() => setGranting(true)}>
              <Plus className="size-4" aria-hidden />
              {t("grant")}
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="h-10 bg-background pl-9"
            />
          </div>
          {!isLoading && (
            <p className="font-mono text-xs text-muted-foreground" aria-live="polite">
              {t("count", { count: rows.length })}
            </p>
          )}
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          isLoading={isLoading}
          caption={t("title")}
          emptyMessage={(data ?? []).length === 0 ? t("noSubscriptions") : tCommon("noMatches")}
        />
      </div>

      {granting && <GrantSubscriptionDialog onClose={() => setGranting(false)} onSaved={refetch} />}
      {revoking && (
        <RevokeSubscriptionDialog subscription={revoking} onClose={() => setRevoking(null)} onSaved={refetch} />
      )}
      {extending && (
        <ExtendSubscriptionDialog subscription={extending} onClose={() => setExtending(null)} onSaved={refetch} />
      )}
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <RequirePermission anyOf={["subscriptions.view"]}>
      <SubscriptionsContent />
    </RequirePermission>
  );
}
