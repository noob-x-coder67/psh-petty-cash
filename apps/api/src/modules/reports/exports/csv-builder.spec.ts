import { describe, expect, it } from "vitest";
import type { Rpt01Response } from "@psh/contracts";
import { buildCsv } from "./csv-builder";

function makeResponse(rows: Rpt01Response["rows"]): Rpt01Response {
  return {
    reportKey: "RPT-01",
    generatedAt: "2026-07-27T10:00:00.000Z",
    generatedBy: { id: "u1", fullName: "Finance Manager" },
    appliedFilters: {},
    period: { start: "2026-07-01", end: "2026-07-31" },
    rows,
    totals: {
      openingBalance: "0.00",
      allocations: "0.00",
      replenishments: "0.00",
      expenditure: "0.00",
      adjustments: "0.00",
      expectedBalance: "0.00",
    },
  };
}

describe("buildCsv", () => {
  it("includes the report header block and column header row", () => {
    const csv = buildCsv(makeResponse([]));
    expect(csv).toContain("Report: RPT-01");
    expect(csv).toContain("Generated: 2026-07-27T10:00:00.000Z by Finance Manager");
    expect(csv).toContain("Unit Code,Unit Name,Opening Balance");
  });

  it("quotes a field containing a comma", () => {
    const csv = buildCsv(
      makeResponse([
        {
          unitId: "a",
          unitCode: "PSH-SOH",
          unitName: "Sohawa, Cadet College",
          openingBalance: "0.00",
          allocations: "0.00",
          replenishments: "0.00",
          expenditure: "0.00",
          adjustments: "0.00",
          expectedBalance: "0.00",
        },
      ]),
    );
    expect(csv).toContain('"Sohawa, Cadet College"');
  });

  it("escapes embedded quotes by doubling them", () => {
    const csv = buildCsv(
      makeResponse([
        {
          unitId: "a",
          unitCode: "PSH-SOH",
          unitName: 'The "Main" Unit',
          openingBalance: "0.00",
          allocations: "0.00",
          replenishments: "0.00",
          expenditure: "0.00",
          adjustments: "0.00",
          expectedBalance: "0.00",
        },
      ]),
    );
    expect(csv).toContain('"The ""Main"" Unit"');
  });

  it("leaves a plain field unquoted", () => {
    const csv = buildCsv(
      makeResponse([
        {
          unitId: "a",
          unitCode: "PSH-SOH",
          unitName: "Sohawa",
          openingBalance: "100.00",
          allocations: "0.00",
          replenishments: "0.00",
          expenditure: "0.00",
          adjustments: "0.00",
          expectedBalance: "100.00",
        },
      ]),
    );
    expect(csv).toContain("PSH-SOH,Sohawa,100.00");
  });
});
