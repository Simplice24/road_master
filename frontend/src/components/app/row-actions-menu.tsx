"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface RowAction {
  key: string;
  label: string;
  icon?: LucideIcon;
  /** Either an in-app link… */
  href?: string;
  /** …or a handler. */
  onSelect?: () => void;
  destructive?: boolean;
  /** Shown under the label; the item is disabled when set. */
  disabledReason?: string;
  /** Omit the action entirely (e.g. missing permission). */
  hidden?: boolean;
  /** Actions with different group numbers are separated by a divider, in order. */
  group?: number;
}

interface RowActionsMenuProps {
  /** What the row is, for the trigger's accessible name ("Actions for {name}"). */
  rowLabel: string;
  actions: RowAction[];
}

/**
 * The "⋯" menu at the end of a table row, styled after the cloud.strettch.com compute table:
 * borderless dots trigger, edge-to-edge items with outline icons, inset dividers between
 * groups, destructive actions in red. Renders nothing when no action is visible, so rows never
 * get an empty menu. Rendered in a portal, so it isn't clipped by the table's scroll container.
 */
export function RowActionsMenu({ rowLabel, actions }: RowActionsMenuProps) {
  const t = useTranslations("Common");
  const visible = actions.filter((action) => !action.hidden);
  if (visible.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={t("rowActions", { name: rowLabel })}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-popup-open:bg-surface-muted data-popup-open:text-foreground"
          />
        }
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-auto min-w-56 max-w-[calc(100vw-2rem)] rounded-lg p-0 py-1 shadow-lg ring-border"
      >
        {visible.map((action, index) => {
          const Icon = action.icon;
          const startsGroup = index > 0 && (action.group ?? 0) !== (visible[index - 1].group ?? 0);
          const content = (
            <>
              {Icon && (
                <Icon
                  aria-hidden
                  className={cn(
                    "mt-0.5 size-[18px] self-start",
                    action.destructive ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
                  )}
                />
              )}
              <span className="flex flex-col">
                <span>{action.label}</span>
                {action.disabledReason && (
                  <span className="text-xs text-muted-foreground">{action.disabledReason}</span>
                )}
              </span>
            </>
          );
          const itemClassName = cn(
            "min-h-11 gap-3 rounded-none px-4 py-2.5 text-[15px] focus:bg-surface-muted",
            action.destructive && "text-red-600 focus:text-red-600 dark:text-red-400",
          );
          return (
            <Fragment key={action.key}>
              {startsGroup && <DropdownMenuSeparator className="mx-3 my-1" />}
              {action.href && !action.disabledReason ? (
                <DropdownMenuItem className={itemClassName} render={<Link href={action.href} />}>
                  {content}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className={itemClassName}
                  disabled={!!action.disabledReason}
                  onClick={action.onSelect}
                >
                  {content}
                </DropdownMenuItem>
              )}
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
