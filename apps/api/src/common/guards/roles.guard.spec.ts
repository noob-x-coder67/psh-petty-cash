import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../types/authenticated-user";
import { RolesGuard } from "./roles.guard";

function makeContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeReflector(roles?: string[], permission?: string): Reflector {
  return {
    getAllAndOverride: vi.fn((key: string) => {
      if (key === "roles") return roles;
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

describe("RolesGuard", () => {
  it("allows when no roles or permission metadata is present", () => {
    const guard = new RolesGuard(makeReflector());
    expect(guard.canActivate(makeContext(baseUser))).toBe(true);
  });

  it("throws when no user is on the request but a role is required", () => {
    const guard = new RolesGuard(makeReflector(["SUPER_ADMIN"]));
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it("throws when the user lacks all required roles", () => {
    const guard = new RolesGuard(makeReflector(["SUPER_ADMIN", "FINANCE_MANAGER"]));
    expect(() => guard.canActivate(makeContext(baseUser))).toThrow(ForbiddenException);
  });

  it("allows when the user has one of the required roles", () => {
    const guard = new RolesGuard(makeReflector(["UNIT_USER"]));
    expect(guard.canActivate(makeContext(baseUser))).toBe(true);
  });

  it("throws when the user lacks the required permission", () => {
    const guard = new RolesGuard(makeReflector(undefined, "month.close"));
    expect(() => guard.canActivate(makeContext(baseUser))).toThrow(ForbiddenException);
  });

  it("allows when the user has the required permission", () => {
    const guard = new RolesGuard(makeReflector(undefined, "expense.create"));
    expect(guard.canActivate(makeContext(baseUser))).toBe(true);
  });

  it("requires both role and permission when both are set", () => {
    const guard = new RolesGuard(makeReflector(["UNIT_USER"], "month.close"));
    expect(() => guard.canActivate(makeContext(baseUser))).toThrow(ForbiddenException);
  });
});
