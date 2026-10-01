"use client";

import { useTranslations } from "next-intl";
import { useApi } from "@/lib/use-api";
import type { Category } from "@/lib/api-types";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/page-header";
import { RequirePermission } from "@/components/app/require-permission";
import { QuestionForm } from "@/components/app/question-form";

function NewQuestionContent() {
  const t = useTranslations("QuestionForm");
  const { data: categories, error, isLoading } = useApi<Category[]>("/category");

  return (
    <div className="flex flex-col">
      <PageHeader backHref="/questions" title={t("createTitle")} subtitle={t("createSubtitle")} />
      {error && (
        <Alert variant="destructive" className="mt-8">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {isLoading && <Skeleton className="mt-8 h-96 w-full" />}
      {!isLoading && categories && <QuestionForm categories={categories} />}
    </div>
  );
}

export default function NewQuestionPage() {
  // The category picker needs categories.view too.
  return (
    <RequirePermission allOf={["questions.create", "categories.view"]}>
      <NewQuestionContent />
    </RequirePermission>
  );
}
