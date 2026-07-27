import type { MonthlyClosingStatus } from "@prisma/client";

export type ComplianceMonthStatus = MonthlyClosingStatus | "MISSING";

export interface ComplianceMonth {
  year: number;
  month: number;
  status: ComplianceMonthStatus;
}

export interface ComplianceResult {
  isCompliant: boolean;
  requiredMonths: ComplianceMonth[];
}

/** The 3 calendar months immediately before (year, month), oldest first — correctly
 * rolling over a year boundary (BR-013, and Phase 7's own exit gate: "timeline renders
 * correctly across a year boundary"). */
export function precedingThreeMonths(year: number, month: number): Array<{ year: number; month: number }> {
  const results: Array<{ year: number; month: number }> = [];
  let y = year;
  let m = month;
  for (let i = 0; i < 3; i += 1) {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    results.unshift({ year: y, month: m });
  }
  return results;
}

/** BR-013/FR-REP-002/003: a fourth-month replenishment is on hold unless all 3 preceding
 * months are CLOSED. `statusByPeriod` is keyed `${year}-${month}`; a period with no entry
 * at all (no monthly_closings row ever created) is MISSING, not OPEN — both count as
 * non-compliant, but the distinction tells the caller what's actually missing. */
export function evaluateThreeMonthCompliance(
  targetYear: number,
  targetMonth: number,
  statusByPeriod: Map<string, MonthlyClosingStatus>,
): ComplianceResult {
  const requiredMonths: ComplianceMonth[] = precedingThreeMonths(targetYear, targetMonth).map(({ year, month }) => ({
    year,
    month,
    status: statusByPeriod.get(`${year}-${month}`) ?? "MISSING",
  }));
  const isCompliant = requiredMonths.every((entry) => entry.status === "CLOSED");
  return { isCompliant, requiredMonths };
}
