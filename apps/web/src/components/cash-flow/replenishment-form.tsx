"use client";

import type { ComplianceResponse } from "@psh/contracts";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@psh/ui";
import { useState } from "react";
import { useReplenishment } from "./use-replenishment";

// Creation only — like CashAllocation, a Replenishment is a create-then-confirm flow
// (§14.4: only *confirmed* replenishments count toward the balance), and confirmation
// has no dedicated UI yet in this demo, matching the pre-existing gap for Allocation
// confirmation (never built a UI either — both are exercised via the API/tests today).
export function ReplenishmentForm({
  unitId,
  compliance,
  canOverrideHold,
}: {
  unitId: string;
  compliance: ComplianceResponse | undefined;
  canOverrideHold: boolean;
}) {
  const { createReplenishment, isCreating, createError, created } = useReplenishment(unitId);
  const [amount, setAmount] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [remarks, setRemarks] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");

  const isHeld = compliance ? !compliance.nextReplenishment.isCompliant : false;
  const needsException = isHeld && canOverrideHold;
  const blocked = isHeld && !canOverrideHold;

  function handleSubmit(): void {
    createReplenishment({
      unitId,
      amount,
      issueDate,
      referenceNo: referenceNo || undefined,
      paymentMode: paymentMode || undefined,
      remarks: remarks || undefined,
      exceptionReason: needsException ? exceptionReason.trim() : undefined,
    });
    setAmount("");
    setReferenceNo("");
    setRemarks("");
    setExceptionReason("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record Replenishment</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isHeld ? (
          <div className="rounded-control border border-coral-500/40 bg-coral-500/10 p-3 text-sm text-coral-500">
            Hold — Three-Month Closing Incomplete.{" "}
            {canOverrideHold
              ? "You may record an audited exception below to proceed."
              : "A Finance Manager or Super Admin must record an exception to proceed."}
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Amount
            <Input aria-label="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} className="w-32" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Issue Date
            <Input
              aria-label="Issue date"
              type="date"
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
              className="w-40"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Reference No.
            <Input
              aria-label="Reference number"
              value={referenceNo}
              onChange={(event) => setReferenceNo(event.target.value)}
              className="w-40"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Payment Mode
            <Input
              aria-label="Payment mode"
              value={paymentMode}
              onChange={(event) => setPaymentMode(event.target.value)}
              className="w-32"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Remarks
          <Input aria-label="Remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} className="w-full" />
        </label>

        {needsException ? (
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Exception Reason (required to override the hold)
            <Input
              aria-label="Exception reason"
              value={exceptionReason}
              onChange={(event) => setExceptionReason(event.target.value)}
              className="w-full"
            />
          </label>
        ) : null}

        <div>
          <Button
            onClick={handleSubmit}
            disabled={
              isCreating ||
              !amount ||
              !issueDate ||
              blocked ||
              (needsException && !exceptionReason.trim())
            }
          >
            {isCreating ? "Recording..." : "Record Replenishment"}
          </Button>
        </div>
        {createError ? (
          <span className="text-sm text-coral-500">
            {createError instanceof Error ? createError.message : "Could not record the replenishment."}
          </span>
        ) : null}
        {created ? <p className="text-sm text-emerald-500">Recorded — pending receipt confirmation.</p> : null}
      </CardContent>
    </Card>
  );
}
