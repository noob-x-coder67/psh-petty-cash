import { Prisma, type LedgerEntryType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_TYPES,
  ALLOCATION_TYPES,
  computeCategoryPercentage,
  computeCheckAgeDays,
  computeConsolidatedCashAmounts,
  computeNegativeBalanceStreaks,
  sumEntryTypes,
  type LedgerPoint,
} from "./reports.rules";

function d(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

describe("sumEntryTypes", () => {
  it("sums the requested buckets out of a type map", () => {
    const map = new Map<LedgerEntryType, Prisma.Decimal>([
      ["ALLOCATION", d("100.00")],
      ["OPENING", d("50.00")],
      ["EXPENSE", d("-30.00")],
    ]);
    expect(sumEntryTypes(map, ALLOCATION_TYPES).toFixed(2)).toBe("150.00");
  });

  it("returns 0 for an undefined map", () => {
    expect(sumEntryTypes(undefined, ALLOCATION_TYPES).toFixed(2)).toBe("0.00");
  });

  it("treats a missing bucket as 0 rather than skipping the sum", () => {
    const map = new Map<LedgerEntryType, Prisma.Decimal>([["ADJUSTMENT_POSITIVE", d("10.00")]]);
    expect(sumEntryTypes(map, ADJUSTMENT_TYPES).toFixed(2)).toBe("10.00");
  });
});

describe("computeConsolidatedCashAmounts", () => {
  it("folds OPENING into allocations and reports expenditure as a positive magnitude", () => {
    const typeSums = new Map<LedgerEntryType, Prisma.Decimal>([
      ["OPENING", d("1000.00")],
      ["ALLOCATION", d("500.00")],
      ["REPLENISHMENT", d("200.00")],
      ["EXPENSE", d("-350.00")],
      ["ADJUSTMENT_POSITIVE", d("20.00")],
      ["ADJUSTMENT_NEGATIVE", d("-15.00")],
      ["CASH_RETURN", d("-5.00")],
      ["REVERSAL", d("50.00")],
    ]);
    const opening = d("2000.00");
    // Net movement: 1000 + 500 + 200 - 350 + 20 - 15 - 5 + 50 = 1400.00
    const expected = d("3400.00");

    const amounts = computeConsolidatedCashAmounts(opening, expected, typeSums);

    expect(amounts.openingBalance.toFixed(2)).toBe("2000.00");
    expect(amounts.allocations.toFixed(2)).toBe("1500.00"); // OPENING + ALLOCATION
    expect(amounts.replenishments.toFixed(2)).toBe("200.00");
    expect(amounts.expenditure.toFixed(2)).toBe("350.00"); // sign flipped to a magnitude
    expect(amounts.adjustments.toFixed(2)).toBe("50.00"); // 20 - 15 - 5 + 50
    expect(amounts.expectedBalance.toFixed(2)).toBe(expected.toFixed(2));

    // The identity the reconciliation test suite relies on: every one of the 8
    // LedgerEntryType values is covered by exactly one bucket, so the components must
    // always sum back to the independently-computed expectedBalance.
    const reconciled = amounts.openingBalance
      .plus(amounts.allocations)
      .plus(amounts.replenishments)
      .minus(amounts.expenditure)
      .plus(amounts.adjustments);
    expect(reconciled.toFixed(2)).toBe(amounts.expectedBalance.toFixed(2));
  });

  it("handles an account with no ledger activity in range at all", () => {
    const amounts = computeConsolidatedCashAmounts(d("0.00"), d("0.00"), undefined);
    expect(amounts.allocations.toFixed(2)).toBe("0.00");
    expect(amounts.replenishments.toFixed(2)).toBe("0.00");
    expect(amounts.expenditure.toFixed(2)).toBe("0.00");
    expect(amounts.adjustments.toFixed(2)).toBe("0.00");
  });
});

describe("computeCheckAgeDays", () => {
  it("counts days between entry and check for a checked voucher", () => {
    const enteredAt = new Date("2026-07-01T00:00:00.000Z");
    const checkedAt = new Date("2026-07-05T00:00:00.000Z");
    expect(computeCheckAgeDays(enteredAt, checkedAt, new Date("2026-08-01T00:00:00.000Z"))).toBe(4);
  });

  it("counts days between entry and now for an unchecked voucher", () => {
    const enteredAt = new Date("2026-07-01T00:00:00.000Z");
    const now = new Date("2026-07-10T00:00:00.000Z");
    expect(computeCheckAgeDays(enteredAt, null, now)).toBe(9);
  });

  it("returns 0 when entered and checked on the same instant", () => {
    const enteredAt = new Date("2026-07-01T00:00:00.000Z");
    expect(computeCheckAgeDays(enteredAt, enteredAt, new Date("2026-08-01T00:00:00.000Z"))).toBe(0);
  });
});

describe("computeCategoryPercentage", () => {
  it("computes a percentage of the grand total", () => {
    expect(computeCategoryPercentage(d("25.00"), d("100.00"))).toBe(25);
  });

  it("returns 0 when the grand total is zero, instead of dividing by zero", () => {
    expect(computeCategoryPercentage(d("0.00"), d("0.00"))).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    expect(computeCategoryPercentage(d("1.00"), d("3.00"))).toBe(33.33);
  });
});

describe("computeNegativeBalanceStreaks", () => {
  const NOW = new Date("2026-07-27T00:00:00.000Z");

  function point(dateStr: string, balance: string, sourceId = "v1"): LedgerPoint {
    return {
      effectiveDate: new Date(`${dateStr}T00:00:00.000Z`),
      balanceAfter: d(balance),
      sourceTable: "expense_vouchers",
      sourceId,
    };
  }

  it("returns no streaks when the balance never goes negative", () => {
    const entries = [point("2026-07-01", "100.00"), point("2026-07-02", "50.00")];
    expect(computeNegativeBalanceStreaks(entries, NOW)).toEqual([]);
  });

  it("detects a single streak that recovers, with the correct duration and trigger", () => {
    const entries = [
      point("2026-07-01", "100.00"),
      point("2026-07-05", "-50.00", "trigger-voucher"),
      point("2026-07-08", "200.00"),
    ];
    const streaks = computeNegativeBalanceStreaks(entries, NOW);
    expect(streaks).toHaveLength(1);
    expect(streaks[0]?.startDate).toEqual(new Date("2026-07-05T00:00:00.000Z"));
    expect(streaks[0]?.endDate).toEqual(new Date("2026-07-08T00:00:00.000Z"));
    expect(streaks[0]?.durationDays).toBe(3);
    expect(streaks[0]?.triggerSourceId).toBe("trigger-voucher");
    expect(streaks[0]?.lowestBalance.toFixed(2)).toBe("-50.00");
  });

  it("tracks the lowest balance across a streak that dips further before recovering", () => {
    const entries = [
      point("2026-07-01", "-10.00"),
      point("2026-07-02", "-90.00"),
      point("2026-07-03", "-40.00"),
      point("2026-07-04", "5.00"),
    ];
    const streaks = computeNegativeBalanceStreaks(entries, NOW);
    expect(streaks).toHaveLength(1);
    expect(streaks[0]?.lowestBalance.toFixed(2)).toBe("-90.00");
  });

  it("leaves a streak open (endDate null) if the account is still negative as of `now`", () => {
    const entries = [point("2026-07-01", "100.00"), point("2026-07-20", "-30.00")];
    const streaks = computeNegativeBalanceStreaks(entries, NOW);
    expect(streaks).toHaveLength(1);
    expect(streaks[0]?.endDate).toBeNull();
    expect(streaks[0]?.durationDays).toBe(7); // 2026-07-20 -> 2026-07-27
  });

  it("detects multiple separate streaks", () => {
    const entries = [
      point("2026-07-01", "-5.00"),
      point("2026-07-02", "10.00"),
      point("2026-07-03", "20.00"),
      point("2026-07-04", "-15.00"),
      point("2026-07-05", "30.00"),
    ];
    const streaks = computeNegativeBalanceStreaks(entries, NOW);
    expect(streaks).toHaveLength(2);
    expect(streaks[0]?.startDate).toEqual(new Date("2026-07-01T00:00:00.000Z"));
    expect(streaks[0]?.endDate).toEqual(new Date("2026-07-02T00:00:00.000Z"));
    expect(streaks[1]?.startDate).toEqual(new Date("2026-07-04T00:00:00.000Z"));
    expect(streaks[1]?.endDate).toEqual(new Date("2026-07-05T00:00:00.000Z"));
  });

  it("returns an empty array for no entries", () => {
    expect(computeNegativeBalanceStreaks([], NOW)).toEqual([]);
  });
});
