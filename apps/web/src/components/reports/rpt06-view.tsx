"use client";

import type { Rpt06Response } from "@psh/contracts";
import { Badge, CheckedMarker, Money } from "@psh/ui";

export function Rpt06View({ response }: { response: Rpt06Response }) {
  const summary = response.summary;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryStat label="Total" value={summary.totalVouchers} />
        <SummaryStat label="Checked" value={summary.checkedCount} />
        <SummaryStat label="Unchecked" value={summary.uncheckedCount} attention={summary.uncheckedCount > 0} />
        <SummaryStat label="Missing bill" value={summary.missingBillCount} attention={summary.missingBillCount > 0} />
        <SummaryStat
          label="Avg check age"
          value={summary.avgCheckAgeDays === null ? "—" : `${summary.avgCheckAgeDays}d`}
        />
      </div>

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-0">
            <tr>
              <th className="border-b border-border px-3 py-2 text-left font-medium text-ink-muted">Date</th>
              <th className="border-b border-border px-3 py-2 text-left font-medium text-ink-muted">Voucher No.</th>
              <th className="border-b border-border px-3 py-2 text-left font-medium text-ink-muted">Unit</th>
              <th className="border-b border-border px-3 py-2 text-left font-medium text-ink-muted">Vendor</th>
              <th className="border-b border-border px-3 py-2 text-right font-medium text-ink-muted">Amount</th>
              <th className="border-b border-border px-3 py-2 text-center font-medium text-ink-muted">Bill</th>
              <th className="border-b border-border px-3 py-2 text-center font-medium text-ink-muted">Checked</th>
              <th className="border-b border-border px-3 py-2 text-right font-medium text-ink-muted">Check age</th>
            </tr>
          </thead>
          <tbody>
            {response.rows.map((row) => (
              <tr key={row.voucherId} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-ink">{row.expenseDate}</td>
                <td className="px-3 py-2 text-ink">{row.voucherNo}</td>
                <td className="px-3 py-2 text-ink">{row.unitCode}</td>
                <td className="px-3 py-2 text-ink">{row.vendorName}</td>
                <td className="px-3 py-2 text-right">
                  <Money value={row.billTotal} />
                </td>
                <td className="px-3 py-2 text-center">
                  {row.hasBill ? <Badge variant="positive">Present</Badge> : <Badge variant="negative">Missing</Badge>}
                </td>
                <td className="px-3 py-2 text-center">
                  <CheckedMarker checked={row.checked} />
                </td>
                <td className="px-3 py-2 text-right text-ink">
                  {row.checkAgeDays === null ? "—" : `${row.checkAgeDays}d`}
                </td>
              </tr>
            ))}
            {response.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-ink-muted">
                  No vouchers match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: string | number;
  attention?: boolean;
}) {
  return (
    <div className="rounded-card border border-border bg-surface-1 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${attention ? "text-amber-500" : "text-ink"}`}>{value}</p>
    </div>
  );
}
