import type { MonthlyClosingStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { evaluateThreeMonthCompliance, precedingThreeMonths } from "./replenishments.rules";

describe("precedingThreeMonths", () => {
  it("returns the 3 preceding months, oldest first, within the same year", () => {
    expect(precedingThreeMonths(2026, 7)).toEqual([
      { year: 2026, month: 4 },
      { year: 2026, month: 5 },
      { year: 2026, month: 6 },
    ]);
  });

  it("rolls over a year boundary when the target month is January", () => {
    expect(precedingThreeMonths(2027, 1)).toEqual([
      { year: 2026, month: 10 },
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
    ]);
  });

  it("rolls over a year boundary partially when the target month is February", () => {
    expect(precedingThreeMonths(2027, 2)).toEqual([
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
    ]);
  });

  it("rolls over a year boundary partially when the target month is March", () => {
    expect(precedingThreeMonths(2027, 3)).toEqual([
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
    ]);
  });
});

describe("evaluateThreeMonthCompliance", () => {
  function statusMap(entries: Array<[string, MonthlyClosingStatus]>): Map<string, MonthlyClosingStatus> {
    return new Map(entries);
  }

  it("is compliant when all 3 preceding months are CLOSED", () => {
    const result = evaluateThreeMonthCompliance(
      2026,
      7,
      statusMap([
        ["2026-4", "CLOSED"],
        ["2026-5", "CLOSED"],
        ["2026-6", "CLOSED"],
      ]),
    );
    expect(result.isCompliant).toBe(true);
    expect(result.requiredMonths.every((m) => m.status === "CLOSED")).toBe(true);
  });

  it("is not compliant when one preceding month is still OPEN", () => {
    const result = evaluateThreeMonthCompliance(
      2026,
      7,
      statusMap([
        ["2026-4", "CLOSED"],
        ["2026-5", "OPEN"],
        ["2026-6", "CLOSED"],
      ]),
    );
    expect(result.isCompliant).toBe(false);
    expect(result.requiredMonths.find((m) => m.month === 5)?.status).toBe("OPEN");
  });

  it("is not compliant when a preceding month has no record at all (MISSING, not OPEN)", () => {
    const result = evaluateThreeMonthCompliance(
      2026,
      7,
      statusMap([
        ["2026-4", "CLOSED"],
        ["2026-6", "CLOSED"],
      ]),
    );
    expect(result.isCompliant).toBe(false);
    expect(result.requiredMonths.find((m) => m.month === 5)?.status).toBe("MISSING");
  });

  it("is not compliant when nothing has ever been recorded", () => {
    const result = evaluateThreeMonthCompliance(2026, 7, new Map());
    expect(result.isCompliant).toBe(false);
    expect(result.requiredMonths.every((m) => m.status === "MISSING")).toBe(true);
  });

  it("correctly evaluates a target month that itself crosses a year boundary", () => {
    const result = evaluateThreeMonthCompliance(
      2027,
      1,
      statusMap([
        ["2026-10", "CLOSED"],
        ["2026-11", "CLOSED"],
        ["2026-12", "CLOSED"],
      ]),
    );
    expect(result.isCompliant).toBe(true);
    expect(result.requiredMonths.map((m) => m.year)).toEqual([2026, 2026, 2026]);
  });
});
