"use client";

import type { ComplianceResponse } from "@psh/contracts";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@psh/ui";
import { useState } from "react";
import { useReplenishmentRequest } from "./use-replenishment-request";

// ADR-0010: the unit submits a request (amount + reason only) — Finance decides
// separately (ReplenishmentApprovalQueue). BR-013 is enforced server-side at
// submission; the unit has no override path at all, so unlike the old
// direct-create ReplenishmentForm, there's no exception-reason box here — a held unit
// just can't submit, full stop.
export function ReplenishmentRequestForm({
  unitId,
  compliance,
}: {
  unitId: string;
  compliance: ComplianceResponse | undefined;
}) {
  const { submitRequest, isSubmitting, submitError, submitted } = useReplenishmentRequest(unitId);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const isHeld = compliance ? !compliance.nextReplenishment.isCompliant : false;

  function handleSubmit(): void {
    submitRequest({ unitId, amount, reason: reason.trim() });
    setAmount("");
    setReason("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request Replenishment</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isHeld ? (
          <Alert variant="danger" title="Hold — Three-Month Closing Incomplete">
            One of the preceding three monthly closings for this unit isn&apos;t complete (BR-013), so a
            replenishment request can&apos;t be submitted yet. A Finance Manager or Super Admin can record an
            audited exception if this is genuinely needed before the closings catch up.
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="replenishment-request-amount">Amount</Label>
            <Input
              id="replenishment-request-amount"
              aria-label="Amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="replenishment-request-reason">Reason</Label>
            <Input
              id="replenishment-request-reason"
              aria-label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>

        <div>
          <Button onClick={handleSubmit} disabled={isSubmitting || !amount || !reason.trim() || isHeld}>
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
        {submitError ? (
          <Alert variant="danger" title="Couldn't submit the request">
            {submitError instanceof Error ? submitError.message : "Please check the values above and try again."}
          </Alert>
        ) : null}
        {submitted ? <Alert variant="success" title="Submitted — waiting on Finance approval" /> : null}
      </CardContent>
    </Card>
  );
}
