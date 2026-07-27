"use client";

import type { OrganizationalUnit } from "@psh/contracts";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Money, VarianceCell } from "@psh/ui";
import { useState } from "react";
import { ComplianceTimeline } from "./compliance-timeline";
import { useCompliance } from "./use-compliance";
import { useMonthlyClosing, type Period } from "./use-monthly-closing";

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

export function MonthCloseWorkspace({ unit, canClose }: { unit: OrganizationalUnit; canClose: boolean }) {
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

  const [physicalCashCount, setPhysicalCashCount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [showReopenInput, setShowReopenInput] = useState(false);

  const varianceWouldBeNonZero =
    closing?.expectedBalance !== undefined &&
    physicalCashCount !== "" &&
    Number(physicalCashCount) !== Number(closing?.expectedBalance ?? "0");

  function handleSubmitCount(): void {
    recordCashCount({ physicalCashCount, remarks: remarks || undefined });
    setPhysicalCashCount("");
    setRemarks("");
  }

  function handleClose(): void {
    if (closing?.id) closeMonth(closing.id);
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

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Year
          <Input
            aria-label="Period year"
            type="number"
            value={period.year}
            onChange={(event) => setPeriod((prev) => ({ ...prev, year: Number(event.target.value) }))}
            className="w-24"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Month
          <select
            aria-label="Period month"
            value={period.month}
            onChange={(event) => setPeriod((prev) => ({ ...prev, month: Number(event.target.value) }))}
            className="psh-focus-ring h-10 rounded-control border border-border bg-surface-1 px-2 text-sm text-ink"
          >
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </label>
        {closing ? <Badge variant={closing.status === "CLOSED" ? "positive" : "attention"}>{closing.status}</Badge> : null}
      </div>

      {compliance ? (
        <Card>
          <CardHeader>
            <CardTitle>Three-Month Compliance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <ComplianceTimeline months={compliance.timeline} />
            <p className="text-sm text-ink-muted">
              {compliance.nextReplenishment.isCompliant
                ? "A fourth-month replenishment is currently eligible."
                : "Hold — Three-Month Closing Incomplete: a replenishment this month requires a Finance Manager/Super Admin exception."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? <p className="text-sm text-ink-muted">Loading...</p> : null}

      {closing ? (
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

            {closing.status === "OPEN" ? (
              <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
                <label className="flex flex-col gap-1 text-xs text-ink-muted">
                  Physical Cash Count
                  <Input
                    aria-label="Physical cash count"
                    value={physicalCashCount}
                    onChange={(event) => setPhysicalCashCount(event.target.value)}
                    className="w-40"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink-muted">
                  Remarks {varianceWouldBeNonZero ? "(required)" : "(optional)"}
                  <Input
                    aria-label="Remarks"
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    className="w-64"
                  />
                </label>
                <Button onClick={handleSubmitCount} disabled={isRecording || !physicalCashCount}>
                  {isRecording ? "Saving..." : "Save Cash Count"}
                </Button>
                {recordError ? (
                  <span className="text-sm text-coral-500">
                    {recordError instanceof Error ? recordError.message : "Could not save the cash count."}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
              {closing.status === "OPEN" && canClose ? (
                <Button onClick={handleClose} disabled={isClosing || !closing.physicalCashCount}>
                  {isClosing ? "Closing..." : "Close Month"}
                </Button>
              ) : null}
              {closeError ? (
                <span className="text-sm text-coral-500">
                  {closeError instanceof Error ? closeError.message : "Could not close the month."}
                </span>
              ) : null}

              {closing.status === "CLOSED" && canClose ? (
                showReopenInput ? (
                  <>
                    <Input
                      aria-label="Reopen reason"
                      placeholder="Reason for reopening"
                      value={reopenReason}
                      onChange={(event) => setReopenReason(event.target.value)}
                      className="w-64"
                    />
                    <Button variant="secondary" onClick={handleReopen} disabled={isReopening || !reopenReason.trim()}>
                      Confirm Reopen
                    </Button>
                    <Button variant="ghost" onClick={() => setShowReopenInput(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" onClick={() => setShowReopenInput(true)}>
                    Reopen Month
                  </Button>
                )
              ) : null}
              {reopenError ? (
                <span className="text-sm text-coral-500">
                  {reopenError instanceof Error ? reopenError.message : "Could not reopen the month."}
                </span>
              ) : null}
            </div>

            {closing.status === "CLOSED" ? (
              <p className="text-xs text-ink-muted">
                Closed by {closing.closedByName}
                {closing.closedAt ? ` at ${new Date(closing.closedAt).toLocaleString()}` : ""}
              </p>
            ) : null}
            {closing.remarks ? <p className="text-sm text-ink">Remarks: {closing.remarks}</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
