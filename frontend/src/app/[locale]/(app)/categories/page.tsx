"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { Link } from "@/i18n/navigation";
import { useApi } from "@/lib/use-api";
import type { Category } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ListChecks } from "lucide-react";
import { RequirePermission } from "@/components/app/require-permission";

function CategoriesContent() {
  const t = useTranslations("CategoryBrowser");
  const { data: categories, error, isLoading } = useApi<Category[]>("/category");
  const canStartExam = useAuth().can("examAttempts.start");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading &&
          Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}

        {!isLoading && categories?.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            {t("noCategories")}
          </p>
        )}

        {categories?.map((category) => (
          <Card key={category.id}>
            <CardHeader>
              <span className="mb-1 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ListChecks className="size-4" />
              </span>
              <CardTitle className="text-base">{category.name}</CardTitle>
              {category.description && (
                <CardDescription className="line-clamp-3">
                  {category.description}
                </CardDescription>
              )}
            </CardHeader>
            {canStartExam && (
              <CardFooter className="bg-transparent pt-0">
                <Button
                  size="sm"
                  className="w-full"
                  render={<Link href={`/exam/start?categoryId=${category.id}`} />}
                  nativeButton={false}
                >
                  {t("practiceThisTopic")}
                </Button>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <RequirePermission anyOf={["categories.view"]}>
      <CategoriesContent />
    </RequirePermission>
  );
}
