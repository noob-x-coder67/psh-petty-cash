import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { parseFiltersQuery, resolveReportPeriod, resolveScopedUnitIds } from "./reports.filters";

function user(overrides: Partial<AuthenticatedUser["unitScope"]>): AuthenticatedUser {
  return {
    id: "u1",
    email: "u@psh.local",
    fullName: "Test User",
    mustChangePassword: false,
    roleKeys: [],
    permissionKeys: [],
    unitScope: { all: false, unitIds: [], ...overrides },
  };
}

describe("parseFiltersQuery", () => {
  it("returns an empty filter when no query string is given", () => {
    expect(parseFiltersQuery(undefined)).toEqual({});
  });

  it("parses and validates a JSON filter string", () => {
    expect(parseFiltersQuery('{"category":"BUILDING"}')).toEqual({ category: "BUILDING" });
  });

  it("rejects malformed JSON with a 400, not a 500", () => {
    expect(() => parseFiltersQuery("{not json")).toThrow(BadRequestException);
  });

  it("rejects a JSON value that fails ReportFilterSchema", () => {
    expect(() => parseFiltersQuery('{"category":"NOT_A_CATEGORY"}')).toThrow(BadRequestException);
  });
});

describe("resolveScopedUnitIds", () => {
  it("an all-scope user with no requested units gets no filter (null = every unit)", () => {
    expect(resolveScopedUnitIds(undefined, user({ all: true }))).toBeNull();
  });

  it("an all-scope user requesting specific units gets exactly those", () => {
    expect(resolveScopedUnitIds(["a", "b"], user({ all: true }))).toEqual(["a", "b"]);
  });

  it("a unit-scoped user with no requested units is clamped to their own units", () => {
    expect(resolveScopedUnitIds(undefined, user({ all: false, unitIds: ["own1"] }))).toEqual(["own1"]);
  });

  it("a unit-scoped user requesting their own unit gets it back", () => {
    expect(resolveScopedUnitIds(["own1"], user({ all: false, unitIds: ["own1", "own2"] }))).toEqual(["own1"]);
  });

  it("a unit-scoped user requesting a unit outside their scope gets an empty result, not expanded access", () => {
    expect(resolveScopedUnitIds(["other"], user({ all: false, unitIds: ["own1"] }))).toEqual([]);
  });

  it("a unit-scoped user requesting a mix of own and foreign units gets only the intersection", () => {
    expect(resolveScopedUnitIds(["own1", "other"], user({ all: false, unitIds: ["own1", "own2"] }))).toEqual([
      "own1",
    ]);
  });
});

describe("resolveReportPeriod", () => {
  it("defaults to the current Asia/Karachi month when no range is given", () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    const period = resolveReportPeriod({}, now);
    expect(period.start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("treats dateTo as inclusive by pushing the exclusive boundary one day later", () => {
    const period = resolveReportPeriod({ dateFrom: "2026-07-01", dateTo: "2026-07-31" });
    expect(period.start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("defaults dateTo to now when only dateFrom is given", () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    const period = resolveReportPeriod({ dateFrom: "2026-07-01" }, now);
    expect(period.start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(period.end).toEqual(now);
  });

  it("defaults dateFrom to the epoch when only dateTo is given", () => {
    const period = resolveReportPeriod({ dateTo: "2026-07-01" });
    expect(period.start.toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-07-02T00:00:00.000Z");
  });
});
