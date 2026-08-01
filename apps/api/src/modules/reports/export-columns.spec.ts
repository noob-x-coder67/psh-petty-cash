import { describe, expect, it } from "vitest";
import { getExportColumns } from "./export-columns";

const managedCategory = {
  id: "0198f7c8-8d9a-7000-8000-000000000001",
  name: "Repair & Maintenance: Building",
  requiresExplanation: false,
  isActive: true,
  sortOrder: 18,
};

describe("managed category export columns", () => {
  it.each(["RPT-03", "RPT-04", "RPT-16"] as const)(
    "%s exports the current category name from managed metadata",
    (reportKey) => {
      const categoryColumn = getExportColumns(reportKey).find(
        (column) => column.header === "Category",
      );

      expect(categoryColumn).toBeDefined();
      expect(
        categoryColumn?.get({ categoryId: managedCategory.id, category: managedCategory }),
      ).toBe(managedCategory.name);
    },
  );

  it("fails explicitly when a category-bearing export row lacks managed metadata", () => {
    const categoryColumn = getExportColumns("RPT-03").find(
      (column) => column.header === "Category",
    );

    expect(() => categoryColumn?.get({ categoryId: managedCategory.id })).toThrow(
      "Report row is missing managed category metadata",
    );
  });
});
