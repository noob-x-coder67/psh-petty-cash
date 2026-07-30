import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../types/authenticated-user";
import { UnitScopeGuard } from "./unit-scope.guard";

function makeContext(
  user: AuthenticatedUser | undefined,
  params: Record<string, string> = {},
  body: Record<string, unknown> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, params, body }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeReflector(source?: string): Reflector {
  return {
    getAllAndOverride: vi.fn(() => source),
  } as unknown as Reflector;
}

const scopedUser: AuthenticatedUser = {
  id: "u1",
  email: "a@psh.local",
  fullName: "A",
  mustChangePassword: false,
  roleKeys: ["UNIT_USER"],
  permissionKeys: [],
  unitScope: { all: false, unitIds: ["unit-1"] },
};

const allScopeUser: AuthenticatedUser = { ...scopedUser, unitScope: { all: true, unitIds: [] } };

describe("UnitScopeGuard", () => {
  it("allows when no scope metadata is present", () => {
    const guard = new UnitScopeGuard(makeReflector());
    expect(guard.canActivate(makeContext(scopedUser))).toBe(true);
  });

  it("throws when no user is on the request but scope is required", () => {
    const guard = new UnitScopeGuard(makeReflector("derived"));
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it("allows 'derived' without checking any specific target unit", () => {
    const guard = new UnitScopeGuard(makeReflector("derived"));
    expect(guard.canActivate(makeContext(scopedUser, { unitId: "unit-999" }))).toBe(true);
  });

  it("allows a param-sourced target when unitScope.all is true", () => {
    const guard = new UnitScopeGuard(makeReflector("param.unitId"));
    expect(guard.canActivate(makeContext(allScopeUser, { unitId: "unit-999" }))).toBe(true);
  });

  it("allows a param-sourced target within unitScope.unitIds", () => {
    const guard = new UnitScopeGuard(makeReflector("param.unitId"));
    expect(guard.canActivate(makeContext(scopedUser, { unitId: "unit-1" }))).toBe(true);
  });

  it("throws for a param-sourced target outside unitScope.unitIds", () => {
    const guard = new UnitScopeGuard(makeReflector("param.unitId"));
    expect(() => guard.canActivate(makeContext(scopedUser, { unitId: "unit-2" }))).toThrow(ForbiddenException);
  });

  it("allows a body-sourced target within unitScope.unitIds", () => {
    const guard = new UnitScopeGuard(makeReflector("body.unitId"));
    expect(guard.canActivate(makeContext(scopedUser, {}, { unitId: "unit-1" }))).toBe(true);
  });

  it("throws for a body-sourced target outside unitScope.unitIds", () => {
    const guard = new UnitScopeGuard(makeReflector("body.unitId"));
    expect(() => guard.canActivate(makeContext(scopedUser, {}, { unitId: "unit-2" }))).toThrow(ForbiddenException);
  });

  it("throws when the target unit identifier is missing", () => {
    const guard = new UnitScopeGuard(makeReflector("param.unitId"));
    expect(() => guard.canActivate(makeContext(scopedUser, {}))).toThrow(ForbiddenException);
  });
});
