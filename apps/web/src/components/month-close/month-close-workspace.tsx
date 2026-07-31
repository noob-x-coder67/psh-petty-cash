"use client";

import { CASH_COUNT_DENOMINATIONS, type OrganizationalUnit } from "@psh/contracts";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmationDialog,
  Input,
  Label,
  Money,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  VarianceCell,
} from "@psh/ui";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ComplianceTimeline } from "./compliance-timeline";
import { DenominationCountTable } from "./denomination-count-table";
import { useCompliance } from "./use-compliance";
import { useMonthlyClosing, type Period } from "./use-monthly-closing";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function currentKarachiPeriod(): Period {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
  };
}

export function MonthCloseWorkspace({
  unit,
  canClose,
  canEnterCashCount,
}: {
  unit: OrganizationalUnit;
  canClose: boolean;
  canEnterCashCount: boolean;
}) {
  const [period, setPeriod] = useState<Period>(currentKarachiPeriod);
  const {
    closing,
    isLoading,
    recordCashCount,
    isRecording,
    recordError,
    closeMonth,
    isClosing,
    closeError,
    reopenMonth,
    isReopening,
    reopenError,
  } = useMonthlyClosing(unit.id, period);
  const { data: compliance } = useCompliance(unit.id);

  const [denominationCounts, setDenominationCounts] = useState<Record<number, number>>({});
  const [remarks, setRemarks] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [showReopenInput, setShowReopenInput] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const enteredTotal = CASH_COUNT_DENOMINATIONS.reduce(
    (sum, denomination) => sum + denomination * (denominationCounts[denomination] ?? 0),
    0,
  );
  const varianceWouldBeNonZero =
    closing?.expectedBalance !== undefined && enteredTotal !== Number(closing?.expectedBalance ?? "0");

  function handleSubmitCount(): void {
    const denominations = CASH_COUNT_DENOMINATIONS.map((denomination) => ({
      denomination,
      count: denominationCounts[denomination] ?? 0,
    }));
    recordCashCount({ denominations, remarks: remarks || undefined });
    setDenominationCounts({});
    setRemarks("");
  }

  function handleClose(): void {
    closeMonth();
  }

  function handleReopen(): void {
    if (closing?.id && reopenReason.trim()) {
      reopenMonth({ id: closing.id, reason: reopenReason.trim() });
      setShowReopenInput(false);
      setReopenReason("");
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Month Close</h1>
        <p className="text-sm text-ink-muted">
          {unit.name} ({unit.code})
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-muted-surface p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="month-close-year">Year</Label>
          <Input
            id="month-close-year"
            aria-label="Period year"
            type="number"
            value={period.year}
            onChange={(event) => setPeriod((prev) => ({ ...prev, year: Number(event.target.value) }))}
            className="w-24"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="month-close-month">Month</Label>
          <Select
            value={String(period.month)}
            onValueChange={(value) => setPeriod((prev) => ({ ...prev, month: Number(value) }))}
          >
            <SelectTrigger id="month-close-month" aria-label="Period month" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, index) => (
                <SelectItem key={name} value={String(index + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {closing ? (
          <StatusBadge status={closing.status === "CLOSED" ? "closed" : "open"} className="mb-0.5" />
        ) : null}
      </div>

      {compliance ? (
        <Card>
          <CardHeader>
            <CardTitle>Three-Month Compliance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ComplianceTimeline months={compliance.timeline} />
            {compliance.nextReplenishment.isCompliant ? (
              <Alert variant="success" title="Eligible for fourth-month replenishment" />
            ) : (
              <Alert variant="warning" title="Hold — Three-Month Closing Incomplete">
                A replenishment this month requires a Finance Manager or Super Admin to record an audited exception.
              </Alert>
            )}
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? <p className="text-sm text-ink-muted">Loading...</p> : null}

      {/* ADR-0007: entirely absent for Finance Manager/Super Admin — not editable, not
          read-only. They close administratively without ever seeing the physical count;
          reconciling it is the center's (and Finance Officer's) job exclusively. */}
      {closing && canEnterCashCount ? (
        <Card>
          <CardHeader>
            <CardTitle>Physical Cash Count</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-ink-muted">Expected Balance</p>
                <Money value={closing.expectedBalance ?? "0.00"} className="text-lg font-semibold" />
              </div>
              {closing.physicalCashCount ? (
                <div>
                  <p className="text-xs text-ink-muted">Physical Count / Variance</p>
                  <VarianceCell expected={closing.expectedBalance ?? "0.00"} actual={closing.physicalCashCount} />
                </div>
              ) : null}
            </div>

            {/* Empty for a legacy/pre-feature closing that only ever had a typed total
                (never backfilled) — the VarianceCell above already displays those
                unchanged; this section only adds the breakdown when one was recorded. */}
            {closing.denominations.length > 0 ? (
              <div className="border-t border-border pt-3">
                <p className="mb-1.5 text-xs text-ink-muted">Denomination Breakdown</p>
                <DenominationCountTable
                  counts={Object.fromEntries(closing.denominations.map((d) => [d.denomination, d.count]))}
                  readOnly
                />
              </div>
            ) : null}

            {closing.status === "OPEN" ? (
              <div className="flex flex-col items-start gap-3 border-t border-border pt-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Physical Cash Count</Label>
                  <DenominationCountTable counts={denominationCounts} onChange={setDenominationCounts} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cash-count-remarks">
                    Remarks{" "}
                    <span className="font-normal text-ink-muted">
                      {varianceWouldBeNonZero ? "(required)" : "(optional)"}
                    </span>
                  </Label>
                  <Input
                    id="cash-count-remarks"
                    aria-label="Remarks"
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    className="w-64"
                  />
                </div>
                <Button onClick={handleSubmitCount} disabled={isRecording}>
                  {isRecording ? "Saving..." : "Save Cash Count"}
                </Button>
                {recordError ? (
                  <Alert variant="danger" title="Couldn't save the cash count" className="w-full">
                    {recordError instanceof Error ? recordError.message : "Please try again."}
                  </Alert>
                ) : null}
              </div>
            ) : null}

            {closing.remarks ? <p className="text-sm text-ink">Remarks: {closing.remarks}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {closing ? (
        <Card>
          <CardHeader>
            <CardTitle>Month Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-ink-muted">Vouchers / Expenditure</p>
                <p className="text-sm text-ink">
                  {closing.summary.voucherCount} · <Money value={closing.summary.totalExpenditure} />
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">Unchecked / Missing Bill / Negative Events</p>
                <p className="text-sm text-ink">
                  {closing.summary.uncheckedCount} / {closing.summary.missingBillCount} /{" "}
                  {closing.summary.negativeBalanceEvents}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              {closing.status === "OPEN" && canClose ? (
                <div className="flex flex-wrap items-center gap-3">
                  {/* Deliberately not a standard primary Button — closing a month is
                      final and audited (BR-013), so it gets its own dark, formal
                      treatment plus a confirmation step, distinct from every other
                      action on this page. */}
                  <button
                    type="button"
                    onClick={() => setConfirmCloseOpen(true)}
                    disabled={isClosing}
                    className="psh-focus-ring inline-flex h-11 items-center gap-2 rounded-control bg-linear-to-r from-midnight-900 to-midnight-700 px-5 text-sm font-semibold text-white shadow-2 transition-all hover:shadow-3 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                    {isClosing ? "Closing..." : "Close Month"}
                  </button>
                </div>
              ) : null}
              {closeError ? (
                <Alert variant="danger" title="Couldn't close the month">
                  {closeError instanceof Error ? closeError.message : "Please try again."}
                </Alert>
              ) : null}

              {closing.status === "CLOSED" && canClose ? (
                showReopenInput ? (
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="reopen-reason">Reason for Reopening</Label>
                      <Input
                        id="reopen-reason"
                        aria-label="Reopen reason"
                        placeholder="Required to reopen a closed month"
                        value={reopenReason}
                        onChange={(event) => setReopenReason(event.target.value)}
                        className="w-64"
                      />
                    </div>
                    <Button variant="secondary" onClick={handleReopen} disabled={isReopening || !reopenReason.trim()}>
                      Confirm Reopen
                    </Button>
                    <Button variant="ghost" onClick={() => setShowReopenInput(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" onClick={() => setShowReopenInput(true)} className="self-start">
                    Reopen Month
                  </Button>
                )
              ) : null}
              {reopenError ? (
                <Alert variant="danger" title="Couldn't reopen the month">
                  {reopenError instanceof Error ? reopenError.message : "Please try again."}
                </Alert>
              ) : null}
            </div>

            {closing.status === "CLOSED" ? (
              <p className="text-xs text-ink-muted">
                Closed by {closing.closedByName}
                {closing.closedAt ? ` at ${new Date(closing.closedAt).toLocaleString()}` : ""}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <ConfirmationDialog
        open={confirmCloseOpen}
        onOpenChange={setConfirmCloseOpen}
        title="Close this month?"
        description="This finalizes the month's cash count and expenditure totals. It can only be reopened afterward with a recorded reason, which is itself audited."
        confirmLabel={isClosing ? "Closing..." : "Close Month"}
        confirmLoading={isClosing}
        onConfirm={() => {
          handleClose();
          setConfirmCloseOpen(false);
        }}
      />
    </div>
  );
}
