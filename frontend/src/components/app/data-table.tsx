"use client";

import type { Key, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  /** Visually hide the header text (e.g. an actions column) while keeping it for screen readers. */
  srOnlyHeader?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => Key;
  isLoading?: boolean;
  emptyMessage: ReactNode;
  /** Accessible table name, rendered as a visually hidden <caption>. */
  caption: string;
  loadingRows?: number;
  className?: string;
}

/**
 * Record table styled after the cloud.strettch.com dashboard: bordered frame with a small
 * radius, grey mono/uppercase header row, full column + row dividers. Scrolls horizontally
 * inside its own frame on narrow screens so the page never scrolls sideways.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  isLoading = false,
  emptyMessage,
  caption,
  loadingRows = 3,
  className,
}: DataTableProps<T>) {
  const cellBase = "border-r border-border px-5 last:border-r-0 sm:px-6";

  return (
    <div className={cn("min-w-0 overflow-hidden rounded-lg border border-border bg-background", className)}>
      <Table aria-busy={isLoading || undefined}>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow className="bg-surface-muted hover:bg-surface-muted">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                scope="col"
                className={cn(
                  cellBase,
                  "h-12 font-mono text-xs font-medium tracking-wider text-foreground/75 uppercase",
                  column.align === "right" && "text-right",
                  column.align === "center" && "text-center",
                )}
              >
                {column.srOnlyHeader ? <span className="sr-only">{column.header}</span> : column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: loadingRows }, (_, index) => (
              <TableRow key={`loading-${index}`} className="hover:bg-transparent">
                {columns.map((column) => (
                  <TableCell key={column.key} className={cn(cellBase, "h-16")}>
                    <Skeleton
                      className={cn(
                        "h-4 w-24",
                        column.align === "right" && "ml-auto",
                        column.align === "center" && "mx-auto w-6",
                      )}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading && rows.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-12 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            rows.map((row) => (
              <TableRow key={getRowKey(row)} className="hover:bg-surface-muted/60">
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      cellBase,
                      "h-16 text-sm text-foreground",
                      column.align === "right" && "text-right",
                      column.align === "center" && "text-center",
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
