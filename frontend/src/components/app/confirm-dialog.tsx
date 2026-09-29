"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** May be async; the dialog shows a busy state and stays open if it throws. */
  onConfirm: () => unknown;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const tCommon = useTranslations("Common");
  const [isBusy, setIsBusy] = useState(false);

  async function handleConfirm() {
    setIsBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The caller reports the error (toast); keep the dialog open so the user can retry.
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-medium">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            {tCommon("cancel")}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            className={destructive ? undefined : "btn-primary"}
            onClick={handleConfirm}
            disabled={isBusy}
          >
            {isBusy ? tCommon("saving") : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
