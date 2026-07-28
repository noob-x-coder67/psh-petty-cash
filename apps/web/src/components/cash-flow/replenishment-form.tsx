"use client";

import type { ComplianceResponse } from "@psh/contracts";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@psh/ui";
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
      <CardContent className="flex flex-col gap-4">
        {isHeld ? (
          <Alert variant="danger" title="Hold — Three-Month Closing Incomplete">
            One of the preceding three monthly closings for this unit isn&apos;t complete (BR-013), so this
            replenishment can&apos;t be recorded yet.{" "}
            {canOverrideHold
              ? "As a Finance Manager or Super Admin, you may record an audited exception below to proceed."
              : "A Finance Manager or Super Admin must record an audited exception before this can proceed — this account doesn't have that permission."}
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="replenishment-amount">Amount</Label>
            <Input
              id="replenishment-amount"
              aria-label="Amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="replenishment-issue-date">Issue Date</Label>
            <Input
              id="replenishment-issue-date"
              aria-label="Issue date"
              type="date"
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="replenishment-reference">
              Reference No. <span className="font-normal text-ink-muted">(optional)</span>
            </Label>
            <Input
              id="replenishment-reference"
              aria-label="Reference number"
              value={referenceNo}
              onChange={(event) => setReferenceNo(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="replenishment-payment-mode">
              Payment Mode <span className="font-normal text-ink-muted">(optional)</span>
            </Label>
            <Input
              id="replenishment-payment-mode"
              aria-label="Payment mode"
              value={paymentMode}
              onChange={(event) => setPaymentMode(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="replenishment-remarks">
            Remarks <span className="font-normal text-ink-muted">(optional)</span>
          </Label>
          <Input
            id="replenishment-remarks"
            aria-label="Remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />
        </div>

        {needsException ? (
          <div className="flex flex-col gap-1.5 rounded-card border border-amber-500/30 bg-amber-100 p-3">
            <Label htmlFor="replenishment-exception-reason" className="text-amber-500">
              Exception Reason — required to override the hold
            </Label>
            <Input
              id="replenishment-exception-reason"
              aria-label="Exception reason"
              value={exceptionReason}
              onChange={(event) => setExceptionReason(event.target.value)}
              className="bg-surface-1"
            />
          </div>
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
          <Alert variant="danger" title="Couldn't record the replenishment">
            {createError instanceof Error ? createError.message : "Please check the values above and try again."}
          </Alert>
        ) : null}
        {created ? <Alert variant="success" title="Recorded — pending receipt confirmation" /> : null}
      </CardContent>
    </Card>
  );
}
