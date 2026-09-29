"use client";

import { useTranslations } from "next-intl";
import type { PermissionCatalogModule } from "@/lib/api-types";
import { Switch } from "@/components/ui/switch";

/**
 * Visual grouping of the backend permission catalog into matrix sections (after the reference
 * "Permission Management" screen: a section per area, a row per module, a column per action).
 * Purely presentational — modules the backend adds later that aren't listed here land in "other".
 */
const GROUPS: { key: string; modules: string[] }[] = [
  { key: "questionBank", modules: ["categories", "questions", "examConfig"] },
  { key: "candidates", modules: ["examAttempts", "transactions"] },
  { key: "administration", modules: ["users", "roles"] },
];

interface PermissionMatrixProps {
  catalog: PermissionCatalogModule[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}

export function usePermissionLabels() {
  const t = useTranslations("PermissionCatalog");
  return {
    module: (module: PermissionCatalogModule) =>
      t.has(`modules.${module.module}`) ? t(`modules.${module.module}`) : module.label,
    /** Precise per-module label, e.g. "View own profile". */
    action: (module: string, action: { action: string; label: string }) =>
      t.has(`actions.${module}.${action.action}`) ? t(`actions.${module}.${action.action}`) : action.label,
    /** Short column header shared across a section, e.g. "View own". */
    column: (action: string, fallback: string) =>
      t.has(`actionNames.${action}`) ? t(`actionNames.${action}`) : fallback,
    group: (key: string) => (t.has(`groups.${key}`) ? t(`groups.${key}`) : key),
  };
}

function groupCatalog(catalog: PermissionCatalogModule[]) {
  const byKey = new Map(catalog.map((module) => [module.module, module]));
  const used = new Set<string>();
  const sections = GROUPS.map((group) => {
    const modules = group.modules.flatMap((key) => {
      const entry = byKey.get(key);
      if (!entry) return [];
      used.add(key);
      return [entry];
    });
    return { key: group.key, modules };
  });
  const rest = catalog.filter((module) => !used.has(module.module));
  if (rest.length > 0) sections.push({ key: "other", modules: rest });
  return sections
    .filter((section) => section.modules.length > 0)
    .map((section) => {
      // Columns are the union of the section's actions, in first-seen order; a module without
      // one of them simply leaves that cell empty.
      const columns: { action: string; label: string }[] = [];
      for (const entry of section.modules) {
        for (const action of entry.actions) {
          if (!columns.some((column) => column.action === action.action)) {
            columns.push({ action: action.action, label: action.label });
          }
        }
      }
      return { ...section, columns };
    });
}

/**
 * The global "All" toggle plus one matrix per section. Every switch toggles a set of permission
 * names; a set switch is on only when every permission in it is on (turning it on from a partial
 * state selects the rest).
 */
export function PermissionMatrix({ catalog, selected, onChange, disabled = false }: PermissionMatrixProps) {
  const t = useTranslations("Roles");
  const labels = usePermissionLabels();
  const sections = groupCatalog(catalog);
  const everything = catalog.flatMap((module) => module.actions.map((action) => action.name));

  const allOn = (names: string[]) => names.length > 0 && names.every((name) => selected.has(name));
  const setMany = (names: string[], on: boolean) => {
    const next = new Set(selected);
    for (const name of names) {
      if (on) next.add(name);
      else next.delete(name);
    }
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex w-fit items-center gap-3">
        <Switch
          size="lg"
          checked={allOn(everything)}
          onCheckedChange={(on) => setMany(everything, on)}
          disabled={disabled}
          aria-label={t("allPermissionsLabel")}
        />
        <span className="text-sm font-medium text-foreground">{t("allLabel")}</span>
      </div>

      {sections.map((section) => {
        const sectionNames = section.modules.flatMap((module) => module.actions.map((action) => action.name));
        const groupLabel = labels.group(section.key);
        return (
          <section key={section.key} aria-labelledby={`perm-group-${section.key}`} className="flex flex-col gap-3">
            <h3 id={`perm-group-${section.key}`} className="font-display text-lg font-medium text-foreground">
              {groupLabel}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-3 pr-6 text-left font-normal">
                      <div className="flex items-center gap-3">
                        <Switch
                          size="lg"
                          checked={allOn(sectionNames)}
                          onCheckedChange={(on) => setMany(sectionNames, on)}
                          disabled={disabled}
                          aria-label={t("allInLabel", { name: groupLabel })}
                        />
                        <span className="font-medium text-foreground">{t("allLabel")}</span>
                      </div>
                    </th>
                    {section.columns.map((column) => {
                      const columnNames = section.modules.flatMap((module) =>
                        module.actions.filter((action) => action.action === column.action).map((action) => action.name),
                      );
                      const columnLabel = labels.column(column.action, column.label);
                      return (
                        <th key={column.action} scope="col" className="px-3 py-3 text-left font-normal">
                          <div className="flex items-center gap-2.5 whitespace-nowrap">
                            <Switch
                              size="lg"
                              checked={allOn(columnNames)}
                              onCheckedChange={(on) => setMany(columnNames, on)}
                              disabled={disabled}
                              aria-label={t("columnLabel", { action: columnLabel, name: groupLabel })}
                            />
                            <span className="text-muted-foreground">{columnLabel}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {section.modules.map((module) => {
                    const moduleLabel = labels.module(module);
                    const rowNames = module.actions.map((action) => action.name);
                    return (
                      <tr key={module.module} className="border-b border-dashed border-border last:border-b-0">
                        <th scope="row" className="py-3 pr-6 text-left font-normal">
                          <div className="flex items-center gap-3">
                            <Switch
                              size="lg"
                              checked={allOn(rowNames)}
                              onCheckedChange={(on) => setMany(rowNames, on)}
                              disabled={disabled}
                              aria-label={t("allInLabel", { name: moduleLabel })}
                            />
                            <span className="whitespace-nowrap text-foreground">{moduleLabel}</span>
                          </div>
                        </th>
                        {section.columns.map((column) => {
                          const action = module.actions.find((candidate) => candidate.action === column.action);
                          return (
                            <td key={column.action} className="px-3 py-3">
                              {action && (
                                <Switch
                                  size="lg"
                                  checked={selected.has(action.name)}
                                  onCheckedChange={(on) => setMany([action.name], on)}
                                  disabled={disabled}
                                  aria-label={`${moduleLabel}: ${labels.action(module.module, action)}`}
                                  title={labels.action(module.module, action)}
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
