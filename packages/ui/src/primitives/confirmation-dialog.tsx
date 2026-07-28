"use client";

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog.js";

export interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Month Close / voucher reversal style actions: red confirm button, warning icon. */
  destructive?: boolean;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
}

// Built on the existing Dialog primitive (not a new modal implementation) so it
// inherits the same Motion entrance/exit and reduced-motion handling. Used for
// Month Close's "Close Month" action and any other destructive/final confirmation
// that already exists in the app — this component adds no new business behaviour,
// only a consistent confirmation shell around an existing onConfirm callback.
export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  destructive = false,
  confirmDisabled = false,
  confirmLoading = false,
}: ConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent open={open} className="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            {destructive ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-coral-100">
                <AlertTriangle className="h-5 w-5 text-coral-500" aria-hidden />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <DialogTitle className="text-base font-semibold text-ink">{title}</DialogTitle>
              <DialogDescription className="text-sm text-ink-muted">{description}</DialogDescription>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={confirmLoading}>
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? "destructive" : "primary"}
              onClick={onConfirm}
              disabled={confirmDisabled || confirmLoading}
            >
              {confirmLoading ? "Working…" : confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
