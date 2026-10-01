"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useApi } from "@/lib/use-api";
import type { Category, QuestionDetail } from "@/lib/api-types";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/page-header";
import { RequirePermission } from "@/components/app/require-permission";
import { QuestionForm } from "@/components/app/question-form";

function EditQuestionContent() {
  const t = useTranslations("QuestionForm");
  const { id } = useParams<{ id: string }>();
  const { data: question, error, isLoading } = useApi<QuestionDetail>(`/question/${id}`);
  const { data: categories, error: categoriesError, isLoading: loadingCategories } =
    useApi<Category[]>("/category");

  const loadError = error ?? categoriesError;
  return (
    <div className="flex flex-col">
      <PageHeader backHref="/questions" title={t("editTitle")} subtitle={t("editSubtitle")} />
      {loadError && (
        <Alert variant="destructive" className="mt-8">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}
      {(isLoading || loadingCategories) && <Skeleton className="mt-8 h-96 w-full" />}
      {!isLoading && !loadingCategories && question && categories && (
        // Keyed by id so navigating between questions resets the form.
        <QuestionForm key={question.id} question={question} categories={categories} />
      )}
    </div>
  );
}

export default function EditQuestionPage() {
  return (
    <RequirePermission allOf={["questions.update", "categories.view"]}>
      <EditQuestionContent />
    </RequirePermission>
  );
}
