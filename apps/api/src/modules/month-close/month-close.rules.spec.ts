import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computeVariance, monthBoundaries, remarksRequired } from "./month-close.rules";

function d(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

describe("monthBoundaries", () => {
  it("returns the first day of the month and the first day of the next month", () => {
    const { start, end } = monthBoundaries(2026, 7);
    expect(start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("rolls over correctly at a year boundary", () => {
    const { start, end } = monthBoundaries(2026, 12);
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("computeVariance", () => {
  it("is zero when physical count matches expected balance exactly", () => {
    expect(computeVariance(d("1000.00"), d("1000.00")).isZero()).toBe(true);
  });

  it("is positive when the physical count exceeds the expected balance", () => {
    expect(computeVariance(d("1050.00"), d("1000.00")).toFixed(2)).toBe("50.00");
  });

  it("is negative when the physical count falls short of the expected balance", () => {
    expect(computeVariance(d("950.00"), d("1000.00")).toFixed(2)).toBe("-50.00");
  });
});

describe("remarksRequired", () => {
  it("is false when variance is exactly zero", () => {
    expect(remarksRequired(d("0.00"))).toBe(false);
  });

  it("is true for a positive variance", () => {
    expect(remarksRequired(d("0.01"))).toBe(true);
  });

  it("is true for a negative variance", () => {
    expect(remarksRequired(d("-0.01"))).toBe(true);
  });
});
