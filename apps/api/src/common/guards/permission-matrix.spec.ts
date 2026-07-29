import "reflect-metadata";
import { type ExecutionContext, ForbiddenException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { RoleKey } from "@prisma/client";
import { buildPermissionMatrix, type Constructor } from "@psh/testing";
import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "../../../../../prisma/seed-data";
// Pure-data module — deliberately not "../../../../../prisma/seed" (the actual seeding
// script), which runs its full main() as an unconditional side effect of being imported
// and calls process.exit(1) on a failed DB connection. This spec has no database at all
// in CI's plain unit-test job, so importing the script itself would crash the whole run.
import { AccountsController } from "../../modules/accounts/accounts.controller";
import { AllocationsController } from "../../modules/allocations/allocations.controller";
import { AttachmentsController } from "../../modules/attachments/attachments.controller";
import { AuthController } from "../../modules/auth/auth.controller";
import { MeController } from "../../modules/auth/me.controller";
import { DashboardController } from "../../modules/dashboard/dashboard.controller";
import { ExpensesController } from "../../modules/expenses/expenses.controller";
import { MonthCloseController } from "../../modules/month-close/month-close.controller";
import { ReplenishmentsController } from "../../modules/month-close/replenishments.controller";
import { OrganizationController } from "../../modules/organization/organization.controller";
import { ExportsController } from "../../modules/reports/exports.controller";
import { PresetsController } from "../../modules/reports/presets.controller";
import { ReportsController } from "../../modules/reports/reports.controller";
import { REQUIRES_PERMISSION_KEY } from "../decorators/requires-permission.decorator";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { RolesGuard } from "./roles.guard";
import type { AuthenticatedUser } from "../types/authenticated-user";

// Same explicit list as audit-coverage.spec.ts, deliberately not shared between the two
// files — each is its own "a new controller must be added here on purpose" checklist,
// mirroring app.module.ts's own explicit registration.
const ALL_CONTROLLERS: Constructor[] = [
  AuthController,
  MeController,
  OrganizationController,
  DashboardController,
  AccountsController,
  AllocationsController,
  ExpensesController,
  AttachmentsController,
  MonthCloseController,
  ReplenishmentsController,
  ReportsController,
  ExportsController,
  PresetsController,
];

// Inverts ROLE_PERMISSIONS (permission -> roles[], as prisma/seed-data.ts defines it) into
// role -> permissions[], since a synthetic AuthenticatedUser needs its full granted set.
const PERMISSIONS_BY_ROLE = new Map<RoleKey, Set<string>>(ROLES.map((role) => [role.key, new Set<string>()]));
for (const [permissionKey, roleKeys] of Object.entries(ROLE_PERMISSIONS)) {
  for (const roleKey of roleKeys) {
    PERMISSIONS_BY_ROLE.get(roleKey)?.add(permissionKey);
  }
}

// Deliberately NOT going through HTTP/login (unlike every *.integration.spec.ts file):
// the seed has no demo user for UNIT_INCHARGE or SUPPORT (prisma/seed-data.ts's DEMO_USERS),
// so an HTTP-based matrix could never cover all 7 roles. A synthetic AuthenticatedUser
// built directly from ROLE_PERMISSIONS, fed straight into RolesGuard.canActivate, covers
// every role regardless of whether a demo account for it exists.
function fixtureUser(roleKey: RoleKey): AuthenticatedUser {
  return {
    id: `fixture-${roleKey}`,
    email: `${roleKey.toLowerCase()}@fixture.local`,
    fullName: roleKey,
    roleKeys: [roleKey],
    permissionKeys: Array.from(PERMISSIONS_BY_ROLE.get(roleKey) ?? []),
    unitScope: { all: true, unitIds: [] },
  };
}

function fakeContext(handler: (...args: unknown[]) => unknown, controller: Constructor, user: AuthenticatedUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

// A real Reflector, not a fake one (unlike roles.guard.spec.ts's own unit test) — this
// needs Nest's actual Reflect.getMetadata lookup against real @RequiresPermission/@Roles
// metadata attached to real controller methods, not a hand-rolled stand-in.
const guard = new RolesGuard({
  getAllAndOverride: (key: string, targets: unknown[]) => {
    for (const target of targets) {
      const value = Reflect.getMetadata(key, target as object);
      if (value !== undefined) return value;
    }
    return undefined;
  },
} as unknown as Reflector);

describe("permission matrix — every (role, route) pair matches ROLE_PERMISSIONS (prisma/seed-data.ts)", () => {
  const matrix = buildPermissionMatrix(ALL_CONTROLLERS, REQUIRES_PERMISSION_KEY, ROLES_KEY);

  it("the walk actually found routes to test (sanity: an empty matrix would pass vacuously)", () => {
    expect(matrix.length).toBeGreaterThan(0);
  });

  it("every seeded permission key is a real, spelled-correctly PERMISSIONS entry", () => {
    const seededKeys = new Set(PERMISSIONS.map((p) => p.key));
    const gatedKeys = new Set(
      matrix.map((route) => route.requiredPermission).filter((key): key is string => key !== undefined),
    );
    for (const key of gatedKeys) {
      expect(seededKeys.has(key)).toBe(true);
    }
  });

  for (const role of ROLES) {
    describe(`${role.key}`, () => {
      for (const route of matrix) {
        const rolePermissions = PERMISSIONS_BY_ROLE.get(role.key) ?? new Set<string>();
        const expectedAllowed =
          (!route.requiredRoles || route.requiredRoles.includes(role.key)) &&
          (!route.requiredPermission || rolePermissions.has(route.requiredPermission));

        it(`${expectedAllowed ? "is allowed" : "is denied"} on ${route.controllerName}.${route.methodName}`, () => {
          const user = fixtureUser(role.key);
          const context = fakeContext(route.handler, route.controller, user);
          if (expectedAllowed) {
            expect(guard.canActivate(context)).toBe(true);
          } else {
            expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
          }
        });
      }
    });
  }
});
