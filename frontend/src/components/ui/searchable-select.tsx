"use client"

import * as React from "react"
import { Combobox } from "@base-ui/react/combobox"
import { cn } from "cn"
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react"

export interface SearchableSelectOption {
  value: string
  label: string
  /** Optional secondary line under the label. */
  description?: string
}

interface SearchableSelectProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
  "aria-describedby"?: string
}

/**
 * Select2-style single select: the trigger looks like an input and shows the chosen option;
 * opening it shows a search box at the top of the dropdown that filters the options by label as
 * you type, with arrow-key navigation, Enter to pick and Escape to close.
 * Built on Base UI's Combobox with the input rendered inside the popup.
 */
function SearchableSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: SearchableSelectProps) {
  const items = React.useMemo(
    () =>
      Combobox.createItems(options, {
        getValue: (option) => option.value,
        // Like select2, typing filters on the visible label only.
        getLabel: (option) => option.label,
      }),
    [options]
  )
  const selected = options.find((option) => option.value === value)

  return (
    <Combobox.Root
      items={items}
      value={value || null}
      onValueChange={(next) => {
        if (next != null) onValueChange(next as string)
      }}
      disabled={disabled}
    >
      <Combobox.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        data-slot="searchable-select-trigger"
        className={cn(
          "flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent pr-2 pl-2.5 text-left text-sm transition-colors outline-none select-none focus-visible:border-primary data-popup-open:border-primary disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          className
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <Combobox.Icon className="shrink-0 text-muted-foreground">
          <ChevronsUpDownIcon className="size-4" />
        </Combobox.Icon>
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={4} className="isolate z-50 outline-none">
          <Combobox.Popup
            aria-label={ariaLabel ?? placeholder}
            className="w-(--anchor-width) max-w-(--available-width) min-w-48 origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-border transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
          >
            <div className="relative border-b border-border p-2">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Combobox.Input
                placeholder={searchPlaceholder}
                className="h-8 w-full rounded-md border border-input bg-background pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
            <Combobox.Empty>
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyText}</div>
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(18rem,calc(var(--available-height)-3.5rem))] overflow-y-auto overscroll-contain p-1 empty:p-0">
              {(option: SearchableSelectOption) => (
                <Combobox.Item
                  key={option.value}
                  value={option.value}
                  className="grid cursor-default grid-cols-[1rem_1fr] items-start gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-surface-muted data-selected:font-medium"
                >
                  <Combobox.ItemIndicator className="col-start-1 mt-0.5 text-primary-text">
                    <CheckIcon className="size-4" />
                  </Combobox.ItemIndicator>
                  <span className="col-start-2 flex min-w-0 flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.description && (
                      <span className="truncate text-xs text-muted-foreground">{option.description}</span>
                    )}
                  </span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

export { SearchableSelect }
