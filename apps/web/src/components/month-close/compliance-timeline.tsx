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

export function ComplianceTimeline({ months }: { months: ComplianceMonth[] }) {
  return (
    <div className="overflow-x-auto">
      <ComplianceRibbon
        months={months.map((month) => ({
          label: `${MONTH_LABELS[month.month - 1]} ${String(month.year).slice(-2)}`,
          status: toRibbonStatus(month.status),
        }))}
      />
    </div>
  );
}
