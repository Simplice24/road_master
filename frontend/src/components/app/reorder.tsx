"use client";

import { useState, type DragEvent, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/** Returns a copy of `items` with the element at `from` moved to `to`. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Drag-and-drop reordering on native HTML5 DnD (no library). Dragging starts only from the
 * grip handle — the row becomes draggable while the handle is pressed — so text inputs inside
 * a row keep normal selection. Native DnD doesn't work on touch screens or with a keyboard;
 * the up/down buttons (ReorderButtons) are the accessible path and must always be rendered too.
 */
export function useDragReorder(onMove: (from: number, to: number) => void) {
  const [armed, setArmed] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  function reset() {
    setArmed(null);
    setDragging(null);
    setOver(null);
  }

  function getItemProps(index: number) {
    return {
      draggable: armed === index,
      onDragStart: (event: DragEvent) => {
        event.dataTransfer.effectAllowed = "move";
        // Firefox won't start a drag without data.
        event.dataTransfer.setData("text/plain", String(index));
        setDragging(index);
      },
      onDragOver: (event: DragEvent) => {
        if (dragging === null) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (over !== index) setOver(index);
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        if (dragging !== null && dragging !== index) onMove(dragging, index);
        reset();
      },
      onDragEnd: reset,
      "data-dragging": dragging === index || undefined,
      "data-drop-target": (over === index && dragging !== null && dragging !== index) || undefined,
    };
  }

  function getHandleProps(index: number) {
    return {
      onPointerDown: (event: PointerEvent) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") setArmed(index);
      },
      onPointerUp: () => {
        if (dragging === null) setArmed(null);
      },
    };
  }

  return { getItemProps, getHandleProps };
}

/** Classes for a row using getItemProps: dims the dragged row, outlines the drop target. */
export const REORDER_ROW_CLASSES =
  "data-dragging:opacity-50 data-drop-target:outline-2 data-drop-target:-outline-offset-2 data-drop-target:outline-primary";

export function DragHandle({ label, ...props }: { label: string } & ReturnType<ReturnType<typeof useDragReorder>["getHandleProps"]>) {
  return (
    <span
      {...props}
      aria-hidden
      title={label}
      className="hidden cursor-grab items-center justify-center rounded-sm text-muted-foreground hover:text-foreground active:cursor-grabbing sm:inline-flex"
    >
      <GripVertical className="size-4" />
    </span>
  );
}

interface ReorderButtonsProps {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  /** What's being moved, for the buttons' accessible names ("Move Weekly up"). */
  itemLabel: string;
  disabled?: boolean;
  className?: string;
}

/** Keyboard/touch-accessible reordering — always shown next to the drag handle. */
export function ReorderButtons({ index, count, onMove, itemLabel, disabled, className }: ReorderButtonsProps) {
  const t = useTranslations("Reorder");
  const base =
    "inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30";
  return (
    <span className={cn("inline-flex items-center", className)}>
      <button
        type="button"
        className={base}
        aria-label={t("moveUp", { name: itemLabel })}
        disabled={disabled || index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <ArrowUp className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className={base}
        aria-label={t("moveDown", { name: itemLabel })}
        disabled={disabled || index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ArrowDown className="size-4" aria-hidden />
      </button>
    </span>
  );
}
