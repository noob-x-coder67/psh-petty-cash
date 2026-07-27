import { Prisma } from "@prisma/client";

/** First day of periodMonth (1-12) in periodYear, and the first day of the following
 * month — the same [start, end) calendar-month convention every other module in this
 * codebase uses for period boundaries (dashboard/period.util.ts, reports.filters.ts). */
export function monthBoundaries(periodYear: number, periodMonth: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(periodYear, periodMonth - 1, 1)),
    end: new Date(Date.UTC(periodYear, periodMonth, 1)),
  };
}

/** FR-CLS-003/§14.4: Variance = Physical Cash Count - Expected Balance. */
export function computeVariance(physicalCashCount: Prisma.Decimal, expectedBalance: Prisma.Decimal): Prisma.Decimal {
  return physicalCashCount.minus(expectedBalance);
}

/** FR-CLS-004: remarks are mandatory whenever variance is non-zero; optional at zero. */
export function remarksRequired(variance: Prisma.Decimal): boolean {
  return !variance.isZero();
}
