import { describe, expect, it } from "vitest";
import { canAccessAdministration, visibleAdministrationModules } from "./admin-navigation";

describe("permission-aware Administration navigation", () => {
  it("shows Finance Manager only the modules backed by their permissions", () => {
    const modules = visibleAdministrationModules(["admin.manage_unit_access", "category.manage"]);
    expect(modules.map((module) => module.key)).toEqual(["users", "permissions", "categories"]);
  });

  it("shows Super Admin every module", () => {
    const modules = visibleAdministrationModules([
      "admin.manage_users_units",
      "admin.manage_unit_access",
      "category.manage",
    ]);
    expect(modules.map((module) => module.key)).toEqual([
      "users",
      "units",
      "permissions",
      "configuration",
      "categories",
    ]);
  });

  it("supports category-only access and hides Administration without a relevant permission", () => {
    expect(visibleAdministrationModules(["category.manage"]).map((module) => module.key)).toEqual(["categories"]);
    expect(canAccessAdministration(["expense.create"])).toBe(false);
    expect(canAccessAdministration(["category.manage"])).toBe(true);
  });
});
