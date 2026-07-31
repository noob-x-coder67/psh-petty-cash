"use client";

import type { OrganizationalUnit } from "@psh/contracts";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Money } from "@psh/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "../../lib/api-client";
import {
  useReplenishmentApprovalQueue,
  useReplenishmentOverride,
  usePendingReplenishmentRequests,
} from "./use-replenishment-request";

type PendingAction = { requestId: string; kind: "approve" | "reject" };

const selectClassName = "psh-focus-ring h-10 rounded-control border border-border bg-surface-1 px-2 text-sm text-ink";

// ADR-0010: Finance's side of the request -> approve -> confirm workflow. Cross-unit by
// design (the approval queue shows every unit's pending requests, not just whichever
// unit happens to be selected in the masthead switcher) — mirrors how
// PendingConfirmations is the single unified place confirming happens from.
export function ReplenishmentApprovalQueue({ canOverrideHold }: { canOverrideHold: boolean }) {
  const { data: pending } = usePendingReplenishmentRequests(true);
  const { approveRequest, isApproving, approveError, rejectRequest, isRejecting, rejectError } =
    useReplenishmentApprovalQueue();

  const [action, setAction] = useState<PendingAction | null>(null);
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [remarks, setRemarks] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  function startAction(requestId: string, kind: "approve" | "reject"): void {
    setAction({ requestId, kind });
    setIssueDate(new Date().toISOString().slice(0, 10));
    setReferenceNo("");
    setPaymentMode("");
    setRemarks("");
    setRejectionReason("");
  }

  function cancelAction(): void {
    setAction(null);
  }

  function submitAction(): void {
    if (!action) return;
    if (action.kind === "approve") {
      approveRequest(
        {
          requestId: action.requestId,
          issueDate,
          referenceNo: referenceNo || undefined,
          paymentMode: paymentMode || undefined,
          remarks: remarks || undefined,
        },
        { onSuccess: () => setAction(null) },
      );
    } else {
      rejectRequest(
        { requestId: action.requestId, rejectionReason: rejectionReason.trim() },
        { onSuccess: () => setAction(null) },
      );
    }
  }

  const isSubmitting = isApproving || isRejecting;
  const actionError = action?.kind === "approve" ? approveError : rejectError;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Replenishment Requests — Pending Approval</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!pending || pending.length === 0 ? (
          <p className="text-sm text-ink-muted">No pending replenishment requests.</p>
        ) : (
          pending.map((row) => (
            <div key={row.id} className="flex flex-col gap-3 rounded-card border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {row.unitCode} — <Money value={row.amount} />
                  </p>
                  <p className="text-xs text-ink-muted">
                    Requested by {row.requestedByName} · {row.reason}
                  </p>
                </div>
                {action?.requestId !== row.id ? (
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => startAction(row.id, "reject")}>
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => startAction(row.id, "approve")}>
                      Approve
                    </Button>
                  </div>
                ) : null}
              </div>

              {action?.requestId === row.id ? (
                <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-0 p-3">
                  {action.kind === "approve" ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`approve-issue-date-${row.id}`}>Issue Date</Label>
                        <Input
                          id={`approve-issue-date-${row.id}`}
                          type="date"
                          value={issueDate}
                          onChange={(event) => setIssueDate(event.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`approve-reference-${row.id}`}>
                          Reference No. <span className="font-normal text-ink-muted">(optional)</span>
                        </Label>
                        <Input
                          id={`approve-reference-${row.id}`}
                          value={referenceNo}
                          onChange={(event) => setReferenceNo(event.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`approve-payment-mode-${row.id}`}>
                          Payment Mode <span className="font-normal text-ink-muted">(optional)</span>
                        </Label>
                        <Input
                          id={`approve-payment-mode-${row.id}`}
                          value={paymentMode}
                          onChange={(event) => setPaymentMode(event.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`approve-remarks-${row.id}`}>
                          Remarks <span className="font-normal text-ink-muted">(optional)</span>
                        </Label>
                        <Input
                          id={`approve-remarks-${row.id}`}
                          value={remarks}
                          onChange={(event) => setRemarks(event.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`reject-reason-${row.id}`}>Rejection Reason</Label>
                      <Input
                        id={`reject-reason-${row.id}`}
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={cancelAction} disabled={isSubmitting}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={submitAction}
                      disabled={isSubmitting || (action.kind === "approve" ? !issueDate : !rejectionReason.trim())}
                    >
                      {isSubmitting ? "Saving..." : action.kind === "approve" ? "Approve" : "Reject"}
                    </Button>
                  </div>
                  {actionError ? (
                    <Alert variant="danger" title="Couldn't save">
                      {actionError instanceof Error ? actionError.message : "Please try again."}
                    </Alert>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
      {canOverrideHold ? <ReplenishmentOverridePanel /> : null}
    </Card>
  );
}

// Finance-initiated audited-exception path (ADR-0010, preserving BR-013's exception
// clause) — creates the request and approves it in one atomic step. Only meaningful for
// a unit that's genuinely held; the service rejects it otherwise.
function ReplenishmentOverridePanel() {
  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: () => apiFetch<OrganizationalUnit[]>("/units"),
  });
  const { submitOverride, isSubmittingOverride, overrideError, overridden } = useReplenishmentOverride();

  const [open, setOpen] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [remarks, setRemarks] = useState("");

  const pettyCashUnits = (units ?? []).filter((unit) => unit.pettyCashEnabled);

  function handleSubmit(): void {
    submitOverride({
      unitId,
      amount,
      reason: reason.trim(),
      exceptionReason: exceptionReason.trim(),
      issueDate,
      referenceNo: referenceNo || undefined,
      paymentMode: paymentMode || undefined,
      remarks: remarks || undefined,
    });
    setAmount("");
    setReason("");
    setExceptionReason("");
    setReferenceNo("");
    setRemarks("");
  }

  return (
    <CardContent className="flex flex-col gap-3 border-t border-border pt-4">
      <Button variant="secondary" size="sm" onClick={() => setOpen((prev) => !prev)} className="self-start">
        {open ? "Hide Override" : "Override Hold for a Unit"}
      </Button>
      {open ? (
        <div className="flex flex-col gap-3 rounded-card border border-amber-500/30 bg-amber-100 p-3">
          <p className="text-xs text-amber-500">
            BR-013 audited exception — only for a unit genuinely held by the three-month rule. This creates and
            approves the replenishment in one step; the unit does not submit a request for this case.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="override-unit">Unit</Label>
              <select
                id="override-unit"
                className={selectClassName}
                value={unitId}
                onChange={(event) => setUnitId(event.target.value)}
              >
                <option value="">Select a unit...</option>
                {pettyCashUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="override-amount">Amount</Label>
              <Input id="override-amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="override-issue-date">Issue Date</Label>
              <Input
                id="override-issue-date"
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="override-reference">
                Reference No. <span className="font-normal text-ink-muted">(optional)</span>
              </Label>
              <Input
                id="override-reference"
                value={referenceNo}
                onChange={(event) => setReferenceNo(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="override-payment-mode">
                Payment Mode <span className="font-normal text-ink-muted">(optional)</span>
              </Label>
              <Input
                id="override-payment-mode"
                value={paymentMode}
                onChange={(event) => setPaymentMode(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="override-remarks">
                Remarks <span className="font-normal text-ink-muted">(optional)</span>
              </Label>
              <Input id="override-remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="override-reason">Reason</Label>
            <Input id="override-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="override-exception-reason" className="text-amber-500">
              Exception Reason — required
            </Label>
            <Input
              id="override-exception-reason"
              value={exceptionReason}
              onChange={(event) => setExceptionReason(event.target.value)}
              className="bg-surface-1"
            />
          </div>
          <div>
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmittingOverride || !unitId || !amount || !reason.trim() || !exceptionReason.trim() || !issueDate
              }
            >
              {isSubmittingOverride ? "Submitting..." : "Submit Override"}
            </Button>
          </div>
          {overrideError ? (
            <Alert variant="danger" title="Couldn't submit override">
              {overrideError instanceof Error ? overrideError.message : "Please check the values above and try again."}
            </Alert>
          ) : null}
          {overridden ? (
            <Alert variant="success" title="Override recorded — replenishment created and approved" />
          ) : null}
        </div>
      ) : null}
    </CardContent>
  );
}
