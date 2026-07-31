"use client";

import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Money } from "@psh/ui";
import { useState } from "react";
import { useAllocation, usePendingAllocations } from "./use-allocation";
import { usePendingReplenishments, useReplenishment } from "./use-replenishment";

interface PendingRow {
  kind: "allocation" | "replenishment";
  id: string;
  amount: string;
  issueDate: string;
  referenceNo: string | null;
  remarks: string | null;
}

// The actual fix for the gap found while reviewing Cash Flow permissions:
// allocation.confirm_receipt is already granted to Center User/In-Charge (Appendix A),
// but with no list endpoint they had no way to discover something Finance created in a
// different session — the confirm step used to live only inside AllocationForm/
// ReplenishmentForm's own post-create state, visible only to whoever just created it.
// This card is now the single place confirming happens for both flows.
export function PendingConfirmations({ unitId, canConfirm }: { unitId: string; canConfirm: boolean }) {
  const { confirmAllocation, isConfirming: isConfirmingAllocation, confirmError: allocationConfirmError } =
    useAllocation(unitId);
  const { confirmReplenishment, isConfirming: isConfirmingReplenishment, confirmError: replenishmentConfirmError } =
    useReplenishment(unitId);
  const { data: pendingAllocations } = usePendingAllocations(unitId, canConfirm);
  const { data: pendingReplenishments } = usePendingReplenishments(unitId, canConfirm);

  const [confirming, setConfirming] = useState<PendingRow | null>(null);
  const [confirmedDate, setConfirmedDate] = useState(() => new Date().toISOString().slice(0, 10));

  if (!canConfirm) return null;

  const rows: PendingRow[] = [
    ...(pendingAllocations ?? []).map(
      (allocation): PendingRow => ({
        kind: "allocation",
        id: allocation.id,
        amount: allocation.amount,
        issueDate: allocation.issueDate,
        referenceNo: allocation.referenceNo,
        remarks: allocation.remarks,
      }),
    ),
    ...(pendingReplenishments ?? []).map(
      (replenishment): PendingRow => ({
        kind: "replenishment",
        id: replenishment.id,
        amount: replenishment.amount,
        issueDate: replenishment.issueDate,
        referenceNo: replenishment.referenceNo,
        remarks: replenishment.remarks,
      }),
    ),
  ].sort((a, b) => b.issueDate.localeCompare(a.issueDate));

  if (rows.length === 0) return null;

  function startConfirming(row: PendingRow): void {
    setConfirming(row);
    setConfirmedDate(new Date().toISOString().slice(0, 10));
  }

  function cancelConfirming(): void {
    setConfirming(null);
  }

  // ADR-0009: confirmation is a locked, exact-match attestation against the original
  // allocated/replenished amount — cash is handed over hand-to-hand, so there's no
  // amount to type in and no variance to reconcile here.
  function submitConfirm(): void {
    if (!confirming) return;
    if (confirming.kind === "allocation") {
      confirmAllocation({ allocationId: confirming.id, confirmedDate }, { onSuccess: () => setConfirming(null) });
    } else {
      confirmReplenishment({ replenishmentId: confirming.id, confirmedDate }, { onSuccess: () => setConfirming(null) });
    }
  }

  const isConfirming = isConfirmingAllocation || isConfirmingReplenishment;
  const confirmError = confirming?.kind === "allocation" ? allocationConfirmError : replenishmentConfirmError;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Confirmations</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={`${row.kind}-${row.id}`} className="flex flex-col gap-3 rounded-card border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink">
                  {row.kind === "allocation" ? "Allocation" : "Replenishment"} — {row.amount}
                </p>
                <p className="text-xs text-ink-muted">
                  Issued {row.issueDate}
                  {row.referenceNo ? ` · Ref ${row.referenceNo}` : ""}
                  {row.remarks ? ` · ${row.remarks}` : ""}
                </p>
              </div>
              {confirming?.id !== row.id ? (
                <Button variant="secondary" size="sm" onClick={() => startConfirming(row)}>
                  Confirm Receipt
                </Button>
              ) : null}
            </div>

            {confirming?.id === row.id ? (
              <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-0 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label>Amount Received</Label>
                    <p className="flex h-10 items-center text-sm font-medium text-ink">
                      <Money value={row.amount} />
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`confirm-date-${row.id}`}>Confirmed Date</Label>
                    <Input
                      id={`confirm-date-${row.id}`}
                      aria-label="Confirmed date"
                      type="date"
                      value={confirmedDate}
                      onChange={(event) => setConfirmedDate(event.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={cancelConfirming} disabled={isConfirming}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={submitConfirm} disabled={isConfirming || !confirmedDate}>
                    {isConfirming ? "Confirming..." : "Confirm"}
                  </Button>
                </div>
                {confirmError ? (
                  <Alert variant="danger" title="Couldn't confirm receipt">
                    {confirmError instanceof Error ? confirmError.message : "Please try again."}
                  </Alert>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
