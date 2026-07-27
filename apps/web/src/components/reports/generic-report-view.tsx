"use client";

import { Money } from "@psh/ui";

// Shared table renderer for every non-flagship report (RPT-02/05/07/08/09/10/11/12/13/
// 14/15/16) — these are secondary, list/aggregate-shaped reports without a bespoke chart
// worth building (unlike RPT-01/04's chart/table toggle); a generic, column-order-
// preserving table satisfies SRS §10.2's "filter-rich, exportable, suitable for
// management review" without hand-writing a near-identical component per report.
const MONEY_KEY_PATTERN = /amount|balance|total|expenditure/i;

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function isMoneyColumn(key: string, value: unknown): boolean {
  return MONEY_KEY_PATTERN.test(key) && typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value);
}

interface ComplianceMonthLike {
  year: number;
  month: number;
  status: string;
}

function isComplianceMonthArray(value: unknown): value is ComplianceMonthLike[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "year" in item &&
        "month" in item &&
        "status" in item,
    )
  );
}

// RPT-09's requiredMonths is the one nested-array field the generic view has to render
// (every other Phase 6e/7 report is flat) — formatted as "YYYY-MM:STATUS" rather than
// falling through to Array.prototype.toString's "[object Object]".
function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (isComplianceMonthArray(value)) {
    return value.map((month) => `${month.year}-${String(month.month).padStart(2, "0")}:${month.status}`).join(", ");
  }
  return String(value);
}

export function GenericReportView({ rows }: { rows: Array<Record<string, unknown>> }) {
  const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];

  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-0">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="border-b border-border px-3 py-2 text-left font-medium text-ink-muted"
              >
                {humanizeKey(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            // Report rows have no stable id of their own across every dataset shape —
            // row order is fixed per response and never reordered client-side, so index
            // is a safe key here.
            <tr key={index} className="border-b border-border last:border-0">
              {columns.map((column) => (
                <td key={column} className="px-3 py-2 text-ink">
                  {isMoneyColumn(column, row[column]) ? (
                    <Money value={row[column] as string} />
                  ) : (
                    formatCell(row[column])
                  )}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length || 1} className="px-3 py-6 text-center text-ink-muted">
                No rows match these filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
