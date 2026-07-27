"use client";

import type { Rpt03Response } from "@psh/contracts";
import { CategoryChip, CheckedMarker, Money } from "@psh/ui";

// Table-only, deliberately — this is a voucher/line-item detail report (SRS §10.2's own
// words), and the aggregate view of the same data already exists as RPT-04. A chart of
// line-level detail rows would just be noise.
export function Rpt03View({ response }: { response: Rpt03Response }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 text-sm text-ink-muted">
        <span>
          Vouchers: <span className="font-medium text-ink">{response.summary.voucherCount}</span>
        </span>
        <span>
          Lines: <span className="font-medium text-ink">{response.summary.lineCount}</span>
        </span>
        <span>
          Total: <Money value={response.summary.totalAmount} className="font-medium text-ink" />
        </span>
      </div>

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-0">
            <tr>
              <th className="border-b border-border px-3 py-2 text-left font-medium text-ink-muted">Date</th>
              <th className="border-b border-border px-3 py-2 text-left font-medium text-ink-muted">Voucher No.</th>
              <th className="border-b border-border px-3 py-2 text-left font-medium text-ink-muted">Unit</th>
              <th className="border-b border-border px-3 py-2 text-left font-medium text-ink-muted">Vendor</th>
              <th className="border-b border-border px-3 py-2 text-left font-medium text-ink-muted">Line</th>
              <th className="border-b border-border px-3 py-2 text-left font-medium text-ink-muted">Category</th>
              <th className="border-b border-border px-3 py-2 text-right font-medium text-ink-muted">Amount</th>
              <th className="border-b border-border px-3 py-2 text-center font-medium text-ink-muted">Checked</th>
            </tr>
          </thead>
          <tbody>
            {response.rows.map((row) => (
              <tr key={`${row.voucherId}-${row.lineNo}`} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-ink">{row.expenseDate}</td>
                <td className="px-3 py-2 text-ink">{row.voucherNo}</td>
                <td className="px-3 py-2 text-ink">{row.unitCode}</td>
                <td className="px-3 py-2 text-ink">{row.vendorName}</td>
                <td className="px-3 py-2 text-ink">{row.lineDescription}</td>
                <td className="px-3 py-2">
                  <CategoryChip category={row.category} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={row.lineAmount} />
                </td>
                <td className="px-3 py-2 text-center">
                  <CheckedMarker checked={row.checked} />
                </td>
              </tr>
            ))}
            {response.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-ink-muted">
                  No expense lines match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
