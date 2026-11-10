"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { cn, optionLabel } from "@/lib/utils";
import type { Category, QuestionDetail } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FULL_BLEED, SettingsField, SettingsSection } from "@/components/app/settings-layout";
import { ImageUpload } from "@/components/app/image-upload";
import {
  DragHandle,
  REORDER_ROW_CLASSES,
  ReorderButtons,
  moveItem,
  useDragReorder,
} from "@/components/app/reorder";

// Mirrors backend/src/question/dto/create-question.ts.
const LIMITS = { textMin: 3, optionTextMax: 500 } as const;

interface DraftOption {
  /** Stable React/DnD key: the option id, or a local one for options not saved yet. */
  key: string;
  id?: string;
  text: string;
  imageUrl: string | null;
  isCorrect: boolean;
}

interface Draft {
  categoryId: string;
  text: string;
  explanation: string;
  imageUrl: string | null;
  isActive: boolean;
  allowMultiple: boolean;
  options: DraftOption[];
}

let localKey = 0;
const newOption = (): DraftOption => ({
  key: `new-${++localKey}`,
  text: "",
  imageUrl: null,
  isCorrect: false,
});

function toDraft(question?: QuestionDetail): Draft {
  if (!question) {
    return {
      categoryId: "",
      text: "",
      explanation: "",
      imageUrl: null,
      isActive: true,
      allowMultiple: false,
      options: [newOption(), newOption(), newOption(), newOption()],
    };
  }
  return {
    categoryId: question.categoryId,
    text: question.text,
    explanation: question.explanation ?? "",
    imageUrl: question.imageUrl,
    isActive: question.isActive,
    allowMultiple: question.allowMultiple,
    options: question.options.map((option) => ({
      key: option.id,
      id: option.id,
      text: option.text ?? "",
      imageUrl: option.imageUrl,
      isCorrect: option.isCorrect,
    })),
  };
}

/** Everything except option order — used to tell an order-only edit from a content edit. */
function contentKey(draft: Draft) {
  return JSON.stringify({
    ...draft,
    text: draft.text.trim(),
    explanation: draft.explanation.trim(),
    options: [...draft.options]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(({ key, text, imageUrl, isCorrect }) => ({ key, text: text.trim(), imageUrl, isCorrect })),
  });
}

interface QuestionFormProps {
  /** The saved question (edit), or undefined (create). */
  question?: QuestionDetail;
  categories: Category[];
  /** Called with the saved question after a successful edit. */
  onSaved?: (question: QuestionDetail) => void;
}

export function QuestionForm({ question, categories, onSaved }: QuestionFormProps) {
  const t = useTranslations("QuestionForm");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const { token } = useAuth();
  const isEdit = !!question;

  const [initial, setInitial] = useState(() => toDraft(question));
  const [draft, setDraft] = useState(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const updateOption = (key: string, patch: Partial<DraftOption>) =>
    setDraft((current) => ({
      ...current,
      options: current.options.map((option) => (option.key === key ? { ...option, ...patch } : option)),
    }));
  const trackUpload = (busy: boolean) => setUploads((count) => count + (busy ? 1 : -1));

  function moveOption(from: number, to: number) {
    if (to < 0 || to >= draft.options.length) return;
    setAnnouncement(t("optionMoved", { from: optionLabel(from), to: optionLabel(to) }));
    update({ options: moveItem(draft.options, from, to) });
  }
  const { getItemProps, getHandleProps } = useDragReorder(moveOption);

  function setCorrect(key: string, checked: boolean) {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option) =>
        current.allowMultiple
          ? option.key === key
            ? { ...option, isCorrect: checked }
            : option
          : { ...option, isCorrect: option.key === key },
      ),
    }));
  }

  function setAllowMultiple(allowMultiple: boolean) {
    setDraft((current) => {
      if (allowMultiple) return { ...current, allowMultiple };
      // Back to single answer: keep only the first option marked correct.
      const firstCorrect = current.options.find((option) => option.isCorrect)?.key;
      return {
        ...current,
        allowMultiple,
        options: current.options.map((option) => ({ ...option, isCorrect: option.key === firstCorrect })),
      };
    });
  }

  // ---- Validation (mirrors the API; it validates again) ----
  const correctCount = draft.options.filter((option) => option.isCorrect).length;
  const errors = {
    categoryId: draft.categoryId ? undefined : t("errors.categoryRequired"),
    text: draft.text.trim().length >= LIMITS.textMin ? undefined : t("errors.textMin", { min: LIMITS.textMin }),
    optionCount: draft.options.length >= 2 ? undefined : t("errors.minOptions"),
    correct:
      correctCount === 0
        ? t("errors.noCorrect")
        : !draft.allowMultiple && correctCount > 1
          ? t("errors.oneCorrect")
          : undefined,
    options: Object.fromEntries(
      draft.options.map((option) => [
        option.key,
        !option.text.trim() && !option.imageUrl
          ? t("errors.optionEmpty")
          : option.text.length > LIMITS.optionTextMax
            ? t("errors.optionTooLong", { max: LIMITS.optionTextMax })
            : undefined,
      ]),
    ) as Record<string, string | undefined>,
  };
  const hasErrors =
    !!errors.categoryId ||
    !!errors.text ||
    !!errors.optionCount ||
    !!errors.correct ||
    Object.values(errors.options).some(Boolean);
  const shown = (message: string | undefined) => (showErrors ? message : undefined);

  const contentChanged = useMemo(() => contentKey(draft) !== contentKey(initial), [draft, initial]);
  const orderChanged =
    draft.options.map((option) => option.key).join() !== initial.options.map((option) => option.key).join();
  const dirty = !isEdit || contentChanged || orderChanged;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    if (hasErrors || !token || uploads > 0) return;
    setError(null);
    setIsSaving(true);

    const body = {
      categoryId: draft.categoryId,
      text: draft.text.trim(),
      explanation: draft.explanation.trim(),
      imageUrl: draft.imageUrl,
      isActive: draft.isActive,
      allowMultiple: draft.allowMultiple,
      // Array order is display order.
      options: draft.options.map((option) => ({
        ...(option.id ? { id: option.id } : {}),
        text: option.text.trim(),
        imageUrl: option.imageUrl,
        isCorrect: option.isCorrect,
      })),
    };
    try {
      if (!isEdit) {
        await apiFetch<QuestionDetail>("/question", { method: "POST", token, body });
        toast.success(t("created"));
        router.push("/questions");
        return;
      }
      // An order-only change goes through the dedicated atomic reorder endpoint; any content
      // change saves everything (content + order) in one atomic update.
      const saved = contentChanged
        ? await apiFetch<QuestionDetail>(`/question/${question.id}`, { method: "PUT", token, body })
        : await apiFetch<QuestionDetail>(`/question/${question.id}/options/order`, {
            method: "PUT",
            token,
            body: { optionIds: draft.options.map((option) => option.id) },
          });
      const next = toDraft(saved);
      setInitial(next);
      setDraft(next);
      setShowErrors(false);
      toast.success(t("saved"));
      onSaved?.(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tCommon("error"));
    } finally {
      setIsSaving(false);
    }
  }

  const categoryOptions = categories.map((category) => ({ value: category.id, label: category.name }));
  const usedInAttemptsNote = isEdit ? t("historyNote") : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 bg-surface-muted py-8" style={FULL_BLEED}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <SettingsSection title={t("questionTitle")} description={t("questionDescription")} hint={t("questionHint")}>
            <div className="flex flex-col gap-5">
              <div className="max-w-md">
                <SettingsField id="q-category" label={t("category")} error={shown(errors.categoryId)}>
                  <SearchableSelect
                    id="q-category"
                    value={draft.categoryId}
                    onValueChange={(categoryId) => update({ categoryId })}
                    options={categoryOptions}
                    placeholder={t("chooseCategory")}
                    searchPlaceholder={tCommon("search")}
                    emptyText={tCommon("noMatches")}
                    aria-describedby={shown(errors.categoryId) ? "q-category-error" : undefined}
                    className="h-10"
                  />
                </SettingsField>
              </div>
              <SettingsField id="q-text" label={t("text")} error={shown(errors.text)}>
                <Textarea
                  id="q-text"
                  value={draft.text}
                  onChange={(event) => update({ text: event.target.value })}
                  rows={3}
                  aria-invalid={!!shown(errors.text)}
                  aria-describedby={shown(errors.text) ? "q-text-error" : undefined}
                  required
                />
              </SettingsField>
              <SettingsField id="q-explanation" label={t("explanation")}>
                <Textarea
                  id="q-explanation"
                  value={draft.explanation}
                  onChange={(event) => update({ explanation: event.target.value })}
                  rows={3}
                  placeholder={t("explanationPlaceholder")}
                />
              </SettingsField>
              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleRow
                  id="q-active"
                  label={t("active")}
                  description={t("activeDescription")}
                  checked={draft.isActive}
                  onCheckedChange={(isActive) => update({ isActive })}
                />
                <ToggleRow
                  id="q-multiple"
                  label={t("allowMultiple")}
                  description={t("allowMultipleDescription")}
                  checked={draft.allowMultiple}
                  onCheckedChange={setAllowMultiple}
                />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title={t("imageTitle")} description={t("imageDescription")} hint={t("imageHint")}>
            <ImageUpload
              value={draft.imageUrl}
              onChange={(imageUrl) => update({ imageUrl })}
              label={t("imageTitle")}
              onBusyChange={trackUpload}
            />
          </SettingsSection>

          <SettingsSection title={t("optionsTitle")} description={t("optionsDescription")} hint={t("optionsHint")}>
            <OptionList
              allowMultiple={draft.allowMultiple}
              correctKey={draft.options.find((option) => option.isCorrect)?.key ?? ""}
              onSingleCorrect={(key) => setCorrect(key, true)}
            >
              {draft.options.map((option, index) => {
                const label = optionLabel(index);
                const optionError = shown(errors.options[option.key]);
                return (
                  <li
                    key={option.key}
                    {...getItemProps(index)}
                    className={cn(
                      "flex flex-col gap-3 rounded-lg border border-border bg-background p-3 transition-colors sm:p-4",
                      option.isCorrect && "border-success/50 bg-success/5",
                      REORDER_ROW_CLASSES,
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex shrink-0 flex-col items-center gap-1">
                        <span
                          aria-hidden
                          className="flex size-8 items-center justify-center rounded-md bg-surface-muted font-mono text-sm font-medium"
                        >
                          {label}
                        </span>
                        <DragHandle label={t("dragOption")} {...getHandleProps(index)} />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <Label htmlFor={`opt-${option.key}`} className="sr-only">
                          {t("optionText", { label })}
                        </Label>
                        <Textarea
                          id={`opt-${option.key}`}
                          value={option.text}
                          onChange={(event) => updateOption(option.key, { text: event.target.value })}
                          rows={2}
                          placeholder={t("optionPlaceholder", { label })}
                          aria-invalid={!!optionError}
                          aria-describedby={optionError ? `opt-${option.key}-error` : undefined}
                          className="min-h-0"
                        />
                        {optionError && (
                          <p id={`opt-${option.key}-error`} role="alert" className="text-xs text-destructive">
                            {optionError}
                          </p>
                        )}
                        <ImageUpload
                          compact
                          value={option.imageUrl}
                          onChange={(imageUrl) => updateOption(option.key, { imageUrl })}
                          label={t("optionImage", { label })}
                          onBusyChange={trackUpload}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        {draft.allowMultiple ? (
                          <Switch
                            size="lg"
                            checked={option.isCorrect}
                            onCheckedChange={(checked) => setCorrect(option.key, checked)}
                            aria-label={t("markCorrect", { label })}
                          />
                        ) : (
                          <RadioGroupItem value={option.key} aria-label={t("markCorrect", { label })} />
                        )}
                        <span className={cn(option.isCorrect && "font-medium text-emerald-700 dark:text-emerald-300")}>
                          {option.isCorrect ? t("correctAnswer") : t("markAsCorrect")}
                        </span>
                      </label>
                      <span className="flex items-center gap-1">
                        <ReorderButtons
                          index={index}
                          count={draft.options.length}
                          onMove={moveOption}
                          itemLabel={t("optionName", { label })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => update({ options: draft.options.filter((o) => o.key !== option.key) })}
                          disabled={draft.options.length <= 2}
                          aria-label={t("removeOption", { label })}
                          className="text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          <Trash2 data-icon="inline-start" aria-hidden />
                          {t("remove")}
                        </Button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </OptionList>
            <p className="sr-only" aria-live="polite">
              {announcement}
            </p>
            {(shown(errors.optionCount) || shown(errors.correct)) && (
              <p role="alert" className="text-sm text-destructive">
                {shown(errors.optionCount) ?? shown(errors.correct)}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={() => update({ options: [...draft.options, newOption()] })}
            >
              <Plus data-icon="inline-start" aria-hidden />
              {t("addOption")}
            </Button>
          </SettingsSection>
        </div>

        {/* Summary + save — sticky beside the form on desktop, last on mobile (like Start exam). */}
        <section
          aria-labelledby="question-summary-title"
          className="overflow-hidden rounded-lg border border-border bg-background lg:sticky lg:top-40"
        >
          <div className="p-5 sm:p-7">
            <h2 id="question-summary-title" className="font-display text-xl font-medium">
              {t("summaryTitle")}
            </h2>
            <dl className="mt-5 flex flex-col divide-y divide-border text-sm">
              <SummaryRow label={t("summaryOptions")}>{draft.options.length}</SummaryRow>
              <SummaryRow label={t("summaryCorrect")}>
                {draft.options
                  .map((option, index) => (option.isCorrect ? optionLabel(index) : null))
                  .filter(Boolean)
                  .join(", ") || "—"}
              </SummaryRow>
              <SummaryRow label={t("summaryImages")}>
                {(draft.imageUrl ? 1 : 0) + draft.options.filter((option) => option.imageUrl).length}
              </SummaryRow>
              <SummaryRow label={t("summaryStatus")}>{draft.isActive ? t("active") : t("inactive")}</SummaryRow>
            </dl>
            {usedInAttemptsNote && (
              <p className="mt-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary-text">{usedInAttemptsNote}</p>
            )}
          </div>
          <div className="flex flex-col gap-3 border-t border-border bg-surface-muted/60 px-5 py-4 sm:px-7">
            {showErrors && hasErrors && (
              <Alert variant="destructive" className="bg-background">
                <AlertDescription>{t("fixErrors")}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive" className="bg-background">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="btn-primary h-11 w-full" disabled={isSaving || uploads > 0 || !dirty}>
              {isSaving ? tCommon("saving") : uploads > 0 ? t("waitForUploads") : isEdit ? tCommon("saveChanges") : t("create")}
            </Button>
            <Button type="button" variant="outline" className="h-10 w-full" onClick={() => router.push("/questions")}>
              {isEdit && dirty ? t("discard") : tCommon("back")}
            </Button>
          </div>
        </section>
      </div>
    </form>
  );
}

/** Single-answer questions wrap the list in one radio group; multi-answer ones use checkboxes. */
function OptionList({
  allowMultiple,
  correctKey,
  onSingleCorrect,
  children,
}: {
  allowMultiple: boolean;
  correctKey: string;
  onSingleCorrect: (key: string) => void;
  children: ReactNode;
}) {
  const t = useTranslations("QuestionForm");
  const list = <ol className="flex flex-col gap-3">{children}</ol>;
  if (allowMultiple) return list;
  return (
    <RadioGroup value={correctKey} onValueChange={(value) => onSingleCorrect(String(value))} aria-label={t("correctAnswer")}>
      {list}
    </RadioGroup>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono text-foreground tabular-nums">{children}</dd>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
      <span className="flex flex-col gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        <span id={`${id}-description`} className="text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} aria-describedby={`${id}-description`} />
    </div>
  );
}
