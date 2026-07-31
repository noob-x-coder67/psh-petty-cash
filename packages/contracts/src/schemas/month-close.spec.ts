import { describe, expect, it } from "vitest";
import { CASH_COUNT_DENOMINATIONS, RecordCashCountRequestSchema } from "./month-close.js";

function baseRequest(denominations: Array<{ denomination: number; count: number }>) {
  return {
    unitId: "019fb2a5-2351-7122-9857-0c7bf0a50d23",
    periodYear: 2026,
    periodMonth: 7,
    denominations,
  };
}

const FULL_ZERO_SET = CASH_COUNT_DENOMINATIONS.map((denomination) => ({ denomination, count: 0 }));

describe("RecordCashCountRequestSchema.denominations", () => {
  it("accepts a full set with all-zero counts (a genuinely empty petty cash box)", () => {
    expect(RecordCashCountRequestSchema.safeParse(baseRequest(FULL_ZERO_SET)).success).toBe(true);
  });

  it("accepts a full set with real counts", () => {
    const denominations = CASH_COUNT_DENOMINATIONS.map((denomination, index) => ({ denomination, count: index }));
    expect(RecordCashCountRequestSchema.safeParse(baseRequest(denominations)).success).toBe(true);
  });

  it("rejects a request missing one of the canonical denominations", () => {
    const denominations = FULL_ZERO_SET.filter((row) => row.denomination !== 10);
    expect(RecordCashCountRequestSchema.safeParse(baseRequest(denominations)).success).toBe(false);
  });

  it("rejects a duplicate denomination", () => {
    const denominations = [...FULL_ZERO_SET, { denomination: 5000, count: 1 }];
    expect(RecordCashCountRequestSchema.safeParse(baseRequest(denominations)).success).toBe(false);
  });

  it("rejects an unrecognized denomination", () => {
    const denominations = [...FULL_ZERO_SET.filter((row) => row.denomination !== 10), { denomination: 200, count: 0 }];
    expect(RecordCashCountRequestSchema.safeParse(baseRequest(denominations)).success).toBe(false);
  });

  it("rejects a negative count", () => {
    const denominations = FULL_ZERO_SET.map((row) => (row.denomination === 100 ? { ...row, count: -1 } : row));
    expect(RecordCashCountRequestSchema.safeParse(baseRequest(denominations)).success).toBe(false);
  });
});
