import type { ComplianceMonth } from "@psh/contracts";
import { ComplianceRibbon, type ComplianceMonthStatus } from "@psh/ui";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The API's 3-state MonthComplianceStatus (CLOSED/OPEN/MISSING) maps onto the ribbon's
// 4-state ComplianceMonthStatus — MISSING (no monthly_closings row was ever created) is
// treated the same as HELD, since both mean "this month is what's currently blocking
// compliance". EXCEPTION isn't populated here: that's a property of a specific
// replenishment's audited override, not of a historical month in the timeline itself.
function toRibbonStatus(status: ComplianceMonth["status"]): ComplianceMonthStatus {
  if (status === "CLOSED") return "CLOSED";
  if (status === "OPEN") return "OPEN";
  return "HELD";
}

const LEGEND: Array<{ status: ComplianceMonthStatus; dot: string }> = [
  { status: "CLOSED", dot: "bg-emerald-500" },
  { status: "OPEN", dot: "bg-ink-muted/40" },
  { status: "HELD", dot: "bg-coral-500" },
];

export function ComplianceTimeline({ months }: { months: ComplianceMonth[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <ComplianceRibbon
          months={months.map((month) => ({
            label: `${MONTH_LABELS[month.month - 1]} ${String(month.year).slice(-2)}`,
            status: toRibbonStatus(month.status),
          }))}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3">
        {LEGEND.map((item) => (
          <span key={item.status} className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span aria-hidden className={`h-2 w-2 rounded-full ${item.dot}`} />
            {item.status === "CLOSED" ? "Closed" : item.status === "OPEN" ? "Open" : "Held"}
          </span>
        ))}
      </div>
    </div>
  );
}
