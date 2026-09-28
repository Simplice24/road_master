"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import type { Category, ExamAttempt, ExamConfig } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";

export default function StartExamPage() {
  return (
    <Suspense fallback={null}>
      <StartExamForm />
    </Suspense>
  );
}

function StartExamForm() {
  const t = useTranslations("StartExam");
  const tCommon = useTranslations("Common");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, token, refreshUser } = useAuth();

  const { data: examConfigs, isLoading: loadingConfigs } =
    useApi<ExamConfig[]>("/exam-config");
  const { data: categories, isLoading: loadingCategories } =
    useApi<Category[]>("/category");
  const { data: attempts } = useApi<ExamAttempt[]>("/exam-attempts");

  const [examConfigId, setExamConfigId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>(
    searchParams.get("categoryId") ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeConfigs = useMemo(
    () => (examConfigs ?? []).filter((config) => config.isActive),
    [examConfigs],
  );

  const effectiveConfigId = examConfigId || activeConfigs[0]?.id || "";

  const inProgress = attempts?.find((attempt) => attempt.status === "IN_PROGRESS");
  const selectedConfig = activeConfigs.find((config) => config.id === effectiveConfigId);
  const isFree = !user?.hasUsedFreeExam;
  const price = selectedConfig ? Number(selectedConfig.price) : 0;
  const insufficientBalance =
    !isFree && !!user && !!selectedConfig && Number(user.walletBalance) < price;

  async function handleSubmit() {
    if (!token || !selectedConfig) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const attempt = await apiFetch<ExamAttempt>("/exam-attempts", {
        method: "POST",
        token,
        body: {
          examConfigId: selectedConfig.id,
          categoryId: categoryId || undefined,
        },
      });
      await refreshUser();
      router.push(`/exam/${attempt.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLoading = loadingConfigs || loadingCategories;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {inProgress && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>{t("inProgressNotice")}</AlertTitle>
          <AlertDescription>
            <Link href={`/exam/${inProgress.id}`} className="font-medium underline underline-offset-4">
              {t("resume")}
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {!isLoading && activeConfigs.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("noExamConfigs")}
        </p>
      )}

      {!isLoading && activeConfigs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("examConfig")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <RadioGroup value={effectiveConfigId} onValueChange={setExamConfigId}>
              {activeConfigs.map((config) => (
                <label
                  key={config.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3 has-data-checked:border-primary has-data-checked:bg-primary/5"
                >
                  <RadioGroupItem value={config.id} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{config.name}</p>
                      {isFree ? (
                        <Badge className="bg-gold text-gold-foreground">
                          {t("freeBadge")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {Number(config.price) === 0
                            ? t("free")
                            : `${formatNumber(config.price)} RWF`}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("questions", { count: config.numberOfQuestions })} ·{" "}
                      {t("duration", { minutes: config.durationMinutes })} ·{" "}
                      {t("passMark", { percent: config.passMarkPercent })}
                    </p>
                  </div>
                </label>
              ))}
            </RadioGroup>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">{t("category")}</Label>
              <Select
                value={categoryId || "any"}
                onValueChange={(value) => setCategoryId(!value || value === "any" ? "" : value)}
                items={[
                  { value: "any", label: t("anyCategory") },
                  ...(categories ?? []).map((category) => ({
                    value: category.id,
                    label: category.name,
                  })),
                ]}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue placeholder={t("anyCategory")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("anyCategory")}</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {insufficientBalance && (
              <Alert variant="destructive">
                <AlertDescription className="flex items-center justify-between gap-2">
                  {t("insufficientBalance")}
                  <Button size="sm" render={<Link href="/wallet" />} nativeButton={false}>
                    {t("topUpCta")}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button
              className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
              disabled={isSubmitting || insufficientBalance || !selectedConfig}
              onClick={handleSubmit}
            >
              {isSubmitting ? t("starting") : t("start")}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
