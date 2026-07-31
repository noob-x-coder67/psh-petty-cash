"use client";

import { CASH_COUNT_DENOMINATIONS, type CashCountDenomination } from "@psh/contracts";
import { Input, Money } from "@psh/ui";

// Denomination-based cash count: harder to fake than a typed total, and produces a real
// auditable note breakdown. CASH_COUNT_DENOMINATIONS (from @psh/contracts) is the single
// source of truth for the row list, shared with the API's own validation.
export function DenominationCountTable({
  counts,
  onChange,
  readOnly = false,
}: {
  counts: Record<number, number>;
  onChange?: (counts: Record<number, number>) => void;
  readOnly?: boolean;
}) {
  const rows: CashCountDenomination[] = CASH_COUNT_DENOMINATIONS.map((denomination) => ({
    denomination,
    count: counts[denomination] ?? 0,
  }));
  const total = rows.reduce((sum, row) => sum + row.denomination * row.count, 0);

  function setCount(denomination: number, value: string): void {
    if (!onChange) return;
    const parsed = value === "" ? 0 : Math.max(0, Math.trunc(Number(value)));
    onChange({ ...counts, [denomination]: Number.isFinite(parsed) ? parsed : 0 });
  }

  return (
    <table className="w-full max-w-md text-sm">
      <thead>
        <tr className="text-left text-xs text-ink-muted">
          <th className="pb-1.5 font-normal">Denomination</th>
          <th className="pb-1.5 font-normal">Count</th>
          <th className="pb-1.5 pr-1 text-right font-normal">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.denomination} className="border-t border-border">
            <td className="py-1.5 text-ink">Rs {row.denomination.toLocaleString("en-US")}</td>
            <td className="py-1.5">
              {readOnly ? (
                <span className="text-ink">{row.count}</span>
              ) : (
                <Input
                  aria-label={`Count for Rs ${row.denomination}`}
                  type="number"
                  min={0}
                  step={1}
                  value={row.count === 0 ? "" : row.count}
                  onChange={(event) => setCount(row.denomination, event.target.value)}
                  className="h-8 w-20"
                />
              )}
            </td>
            <td className="py-1.5 pr-1 text-right">
              <Money value={row.denomination * row.count} />
            </td>
          </tr>
        ))}
        <tr className="border-t border-border font-semibold">
          <td className="py-1.5 text-ink" colSpan={2}>
            Total
          </td>
          <td className="py-1.5 pr-1 text-right">
            <Money value={total} />
          </td>
        </tr>
      </tbody>
    </table>
  );
}
