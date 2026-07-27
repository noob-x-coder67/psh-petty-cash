import { describe, expect, it } from "vitest";
import { countWorkingDaysBetween, isBackdated } from "./expenses.rules";

// 2026-07-20 Mon, 21 Tue, 22 Wed, 23 Thu, 24 Fri, 25 Sat, 26 Sun, 27 Mon, 28 Tue, 29 Wed.
const MON = new Date("2026-07-20T00:00:00.000Z");
const TUE = new Date("2026-07-21T00:00:00.000Z");
const FRI = new Date("2026-07-24T00:00:00.000Z");
const NEXT_MON = new Date("2026-07-27T00:00:00.000Z");
const SIX_WORKING_DAYS_LATER = new Date("2026-07-28T00:00:00.000Z"); // Tue
const SEVEN_WORKING_DAYS_LATER = new Date("2026-07-29T00:00:00.000Z"); // Wed

describe("countWorkingDaysBetween", () => {
  it("counts a single weekday immediately after `from`", () => {
    expect(countWorkingDaysBetween(MON, TUE)).toBe(1);
  });

  it("skips the weekend entirely", () => {
    // Fri -> Mon: only Monday counts, Sat/Sun excluded.
    expect(countWorkingDaysBetween(FRI, NEXT_MON)).toBe(1);
  });

  it("counts every weekday in a Mon-Fri run", () => {
    expect(countWorkingDaysBetween(MON, FRI)).toBe(4); // Tue, Wed, Thu, Fri
  });

  it("returns 0 for the same day", () => {
    expect(countWorkingDaysBetween(MON, MON)).toBe(0);
  });
});

describe("isBackdated", () => {
  it("is never backdated when the expense date is today or in the future", () => {
    expect(isBackdated(MON, MON)).toBe(false);
    expect(isBackdated(TUE, MON)).toBe(false);
  });

  it("is not backdated exactly at the threshold (6 working days)", () => {
    expect(isBackdated(MON, SIX_WORKING_DAYS_LATER, 6)).toBe(false);
  });

  it("is backdated one working day past the threshold", () => {
    expect(isBackdated(MON, SEVEN_WORKING_DAYS_LATER, 6)).toBe(true);
  });

  it("respects a custom threshold", () => {
    expect(isBackdated(MON, TUE, 0)).toBe(true);
    expect(isBackdated(MON, MON, 0)).toBe(false);
  });
});
