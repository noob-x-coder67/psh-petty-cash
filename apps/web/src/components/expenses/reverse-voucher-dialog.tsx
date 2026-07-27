"use client";

import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Label } from "@psh/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "../../lib/api-client";

// BR-020: no hard deletion — this creates a compensating reversal voucher rather than
// deleting or mutating the original's financial fields.
export function ReverseVoucherDialog({
  voucherId,
  voucherNo,
  open,
  onOpenChange,
}: {
  voucherId: string;
  voucherNo: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReverse(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/expenses/${voucherId}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reverse voucher");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent open={open}>
        <DialogTitle>Reverse voucher {voucherNo}</DialogTitle>
        <DialogDescription>
          This creates a compensating reversal voucher and posts an offsetting ledger entry. The
          original voucher is retained, marked Reversed.
        </DialogDescription>
        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="reverse-reason">Reason (required)</Label>
          <Input id="reverse-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        {error ? <p className="mt-2 text-sm text-coral-500">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending || reason.trim().length < 10} onClick={() => void handleReverse()}>
            Reverse voucher
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
