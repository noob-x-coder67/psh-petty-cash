import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computeBalanceAfter } from "./ledger.posting";

describe("computeBalanceAfter", () => {
  it("adds a positive-direction entry to the balance", () => {
    const result = computeBalanceAfter(new Prisma.Decimal("1000.00"), 1, new Prisma.Decimal("500.00"));
    expect(result.toFixed(2)).toBe("1500.00");
  });

  it("subtracts a negative-direction entry from the balance", () => {
    const result = computeBalanceAfter(new Prisma.Decimal("1000.00"), -1, new Prisma.Decimal("500.00"));
    expect(result.toFixed(2)).toBe("500.00");
  });

  it("allows the result to go negative (BR-011 — never blocked here)", () => {
    const result = computeBalanceAfter(new Prisma.Decimal("100.00"), -1, new Prisma.Decimal("500.00"));
    expect(result.toFixed(2)).toBe("-400.00");
  });

  it("preserves cents precision", () => {
    const result = computeBalanceAfter(new Prisma.Decimal("10.10"), 1, new Prisma.Decimal("0.05"));
    expect(result.toFixed(2)).toBe("10.15");
  });
});
