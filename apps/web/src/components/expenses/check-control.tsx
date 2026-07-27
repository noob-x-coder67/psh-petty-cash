"use client";

import { Button, CheckedMarker, Dialog, DialogContent, DialogTitle, Input, Label } from "@psh/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "../../lib/api-client";

// FR-CHK-002/BR-008: Checked needs no reason; reverting to Unchecked does (FR-DOC-010).
export function CheckControl({
  voucherId,
  checked,
  canCheck,
}: {
  voucherId: string;
  checked: boolean;
  canCheck: boolean;
}) {
  const router = useRouter();
  const [uncheckOpen, setUncheckOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck(): Promise<void> {
    setPending(true);
    try {
      await apiFetch(`/expenses/${voucherId}/check`, { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark Checked");
    } finally {
      setPending(false);
    }
  }

  async function handleUncheck(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/expenses/${voucherId}/uncheck`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setUncheckOpen(false);
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revert to Unchecked");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <CheckedMarker checked={checked} />
      {canCheck ? (
        checked ? (
          <Button variant="secondary" size="sm" onClick={() => setUncheckOpen(true)}>
            Revert to Unchecked
          </Button>
        ) : (
          <Button size="sm" disabled={pending} onClick={() => void handleCheck()}>
            Mark Checked
          </Button>
        )
      ) : null}
      {error ? <p className="text-xs text-coral-500">{error}</p> : null}

      <Dialog open={uncheckOpen} onOpenChange={setUncheckOpen}>
        <DialogContent open={uncheckOpen}>
          <DialogTitle>Revert to Unchecked</DialogTitle>
          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor="uncheck-reason">Reason (required)</Label>
            <Input id="uncheck-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setUncheckOpen(false)}>
              Cancel
            </Button>
            <Button disabled={pending || reason.trim().length < 10} onClick={() => void handleUncheck()}>
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
