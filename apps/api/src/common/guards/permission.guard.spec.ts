import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../types/authenticated-user";
import { PermissionGuard } from "./permission.guard";

function makeContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeReflector(permission?: string): Reflector {
  return {
    getAllAndOverride: vi.fn((key: string) => {
      if (key === "requiresPermission") return permission;
      return undefined;
    }),
  } as unknown as Reflector;
}

const baseUser: AuthenticatedUser = {
  id: "u1",
  email: "a@psh.local",
  fullName: "A",
  roleKeys: ["UNIT_USER"],
  permissionKeys: ["expense.create"],
  unitScope: { all: false, unitIds: ["unit-1"] },
};

describe("PermissionGuard", () => {
  it("allows when no permission metadata is present", () => {
    const guard = new PermissionGuard(makeReflector());
    expect(guard.canActivate(makeContext(baseUser))).toBe(true);
  });

  it("throws when no user is on the request but a permission is required", () => {
    const guard = new PermissionGuard(makeReflector("month.close"));
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it("throws when the user lacks the required permission", () => {
    const guard = new PermissionGuard(makeReflector("month.close"));
    expect(() => guard.canActivate(makeContext(baseUser))).toThrow(ForbiddenException);
  });

  it("allows when the user has the required permission", () => {
    const guard = new PermissionGuard(makeReflector("expense.create"));
    expect(guard.canActivate(makeContext(baseUser))).toBe(true);
  });
});
