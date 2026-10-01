"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImageIcon, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Category, Paginated, QuestionListItem } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Pagination } from "@/components/app/pagination";
import { RequirePermission } from "@/components/app/require-permission";

const PAGE_SIZE = 20;
const ALL = "all";

function QuestionsContent() {
  const t = useTranslations("Questions");
  const tCommon = useTranslations("Common");
  const { token, can } = useAuth();
  // The form's category picker needs categories.view — mirror the new/edit pages' guards so a
  // visible button never leads to a "not authorized" page.
  const canCreate = can("questions.create") && can("categories.view");
  const canUpdate = can("questions.update") && can("categories.view");
  const canDelete = can("questions.delete");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState(ALL);
  const [image, setImage] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<QuestionListItem | null>(null);

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
  if (categoryId !== ALL) query.set("categoryId", categoryId);
  if (image !== ALL) query.set("image", image);
  if (status !== ALL) query.set("status", status);
  const { data, error, isLoading, refetch } = useApi<Paginated<QuestionListItem>>(`/question?${query}`);
  const { data: categories } = useApi<Category[]>(can("categories.view") ? "/category" : null);

  const categoryOptions = useMemo(
    () => [
      { value: ALL, label: t("allCategories") },
      ...(categories ?? []).map((category) => ({ value: category.id, label: category.name })),
    ],
    [categories, t],
  );
  const imageOptions = [
    { value: ALL, label: t("anyImage") },
    { value: "with", label: t("withImage") },
    { value: "without", label: t("withoutImage") },
  ];
  const statusOptions = [
    { value: ALL, label: t("anyStatus") },
    { value: "active", label: t("active") },
    { value: "inactive", label: t("inactive") },
  ];
  const filtered = !!debouncedSearch || categoryId !== ALL || image !== ALL || status !== ALL;

  function filterSetter(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  }

  async function handleDelete() {
    if (!token || !deleteTarget) return;
    try {
      const result = await apiFetch<{ mode: "soft" | "hard" }>(`/question/${deleteTarget.id}`, {
        method: "DELETE",
        token,
      });
      toast.success(result.mode === "soft" ? t("archived") : t("deleted"));
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon("error"));
      throw err;
    }
  }

  const columns: DataTableColumn<QuestionListItem>[] = [
    {
      key: "text",
      header: t("question"),
      className: "min-w-[18rem] max-w-xl",
      cell: (question) => (
        <span className="flex flex-col gap-1">
          {canUpdate ? (
            <Link
              href={`/questions/${question.id}`}
              className="line-clamp-2 rounded-sm text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {question.text}
            </Link>
          ) : (
            <span className="line-clamp-2">{question.text}</span>
          )}
          <span className="text-xs text-muted-foreground">{question.category.name}</span>
        </span>
      ),
    },
    {
      key: "options",
      header: t("options"),
      align: "right",
      className: "font-mono tabular-nums",
      cell: (question) => question.optionCount,
    },
    {
      key: "image",
      header: t("image"),
      align: "center",
      cell: (question) =>
        question.imageUrl ? (
          <span className="inline-flex items-center gap-1 text-primary-text" title={t("hasImage")}>
            <ImageIcon className="size-4" aria-hidden />
            <span className="sr-only">{t("hasImage")}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            <span aria-hidden>—</span>
            <span className="sr-only">{t("noImage")}</span>
          </span>
        ),
    },
    {
      key: "status",
      header: t("status"),
      cell: (question) =>
        question.isActive ? (
          <StatusBadge tone="success">{t("active")}</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">{t("inactive")}</StatusBadge>
        ),
    },
  ];
  if (canUpdate || canDelete) {
    columns.push({
      key: "actions",
      header: tCommon("actions"),
      srOnlyHeader: true,
      align: "center",
      className: "w-16",
      cell: (question) => (
        <RowActionsMenu
          rowLabel={question.text.slice(0, 60)}
          actions={[
            {
              key: "edit",
              label: tCommon("edit"),
              icon: Pencil,
              href: `/questions/${question.id}`,
              hidden: !canUpdate,
            },
            {
              key: "delete",
              group: 1,
              label: tCommon("delete"),
              icon: Trash2,
              destructive: true,
              hidden: !canDelete,
              onSelect: () => setDeleteTarget(question),
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
            <Button className="btn-primary h-10 px-4" render={<Link href="/questions/new" />} nativeButton={false}>
              <Plus className="size-4" aria-hidden />
              {t("newQuestion")}
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_14rem_12rem_10rem]">
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
          <SearchableSelect
            value={categoryId}
            onValueChange={filterSetter(setCategoryId)}
            options={categoryOptions}
            aria-label={t("category")}
            searchPlaceholder={tCommon("search")}
            emptyText={tCommon("noMatches")}
            className="h-10"
          />
          <SearchableSelect
            value={image}
            onValueChange={filterSetter(setImage)}
            options={imageOptions}
            aria-label={t("image")}
            searchPlaceholder={tCommon("search")}
            emptyText={tCommon("noMatches")}
            className="h-10"
          />
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
          getRowKey={(question) => question.id}
          isLoading={isLoading}
          loadingRows={6}
          caption={t("title")}
          emptyMessage={filtered ? tCommon("noMatches") : t("noQuestions")}
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

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("deleteTitle")}
        description={
          <>
            <span className="mb-2 line-clamp-3 block font-medium text-foreground">{deleteTarget?.text}</span>
            {t("deleteBody")}
          </>
        }
        confirmLabel={tCommon("delete")}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function QuestionsPage() {
  return (
    <RequirePermission anyOf={["questions.view"]}>
      <QuestionsContent />
    </RequirePermission>
  );
}
