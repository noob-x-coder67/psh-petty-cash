"use client";

import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@psh/ui";
import { useState } from "react";
import { useAllocation } from "./use-allocation";

// Creation only — confirming receipt now happens in pending-confirmations.tsx, which
// lists every unconfirmed allocation/replenishment for the unit (including one created
// here) regardless of who created it or which session they're in. An earlier version of
// this form had its own inline "confirm the thing I just created" step, but that only
// ever worked for whoever's own session created the record — the unit user Appendix A
// actually intends to confirm receipt (SRS §8.1 step 5) had no way to reach it, since
// there was no list endpoint at all until pending-confirmations.tsx's backend landed.
export function AllocationForm({ unitId }: { unitId: string }) {
  const { createAllocation, isCreating, createError, created } = useAllocation(unitId);
  const [amount, setAmount] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [remarks, setRemarks] = useState("");

  function handleSubmit(): void {
    createAllocation({
      unitId,
      amount,
      issueDate,
      referenceNo: referenceNo || undefined,
      paymentMode: paymentMode || undefined,
      remarks: remarks || undefined,
    });
    setAmount("");
    setReferenceNo("");
    setRemarks("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record Allocation</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="allocation-amount">Amount</Label>
            <Input
              id="allocation-amount"
              aria-label="Amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="allocation-issue-date">Issue Date</Label>
            <Input
              id="allocation-issue-date"
              aria-label="Issue date"
              type="date"
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="allocation-reference">
              Reference No. <span className="font-normal text-ink-muted">(optional)</span>
            </Label>
            <Input
              id="allocation-reference"
              aria-label="Reference number"
              value={referenceNo}
              onChange={(event) => setReferenceNo(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="allocation-payment-mode">
              Payment Mode <span className="font-normal text-ink-muted">(optional)</span>
            </Label>
            <Input
              id="allocation-payment-mode"
              aria-label="Payment mode"
              value={paymentMode}
              onChange={(event) => setPaymentMode(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="allocation-remarks">
            Remarks <span className="font-normal text-ink-muted">(optional)</span>
          </Label>
          <Input
            id="allocation-remarks"
            aria-label="Remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />
        </div>

        <div>
          <Button onClick={handleSubmit} disabled={isCreating || !amount || !issueDate}>
            {isCreating ? "Recording..." : "Record Allocation"}
          </Button>
        </div>
        {createError ? (
          <Alert variant="danger" title="Couldn't record the allocation">
            {createError instanceof Error ? createError.message : "Please check the values above and try again."}
          </Alert>
        ) : null}
        {created ? <Alert variant="success" title="Recorded — pending receipt confirmation" /> : null}
      </CardContent>
    </Card>
  );
}
