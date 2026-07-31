import "reflect-metadata";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AccountsController } from "../../modules/accounts/accounts.controller";
import { AllocationsController } from "../../modules/allocations/allocations.controller";
import { AttachmentsController } from "../../modules/attachments/attachments.controller";
import { AuthController } from "../../modules/auth/auth.controller";
import { MeController } from "../../modules/auth/me.controller";
import { DashboardController } from "../../modules/dashboard/dashboard.controller";
import { ExpensesController } from "../../modules/expenses/expenses.controller";
import { MonthCloseController } from "../../modules/month-close/month-close.controller";
import { ReplenishmentRequestsController } from "../../modules/month-close/replenishment-requests.controller";
import { ReplenishmentsController } from "../../modules/month-close/replenishments.controller";
import { AdminUnitsController } from "../../modules/organization/admin-units.controller";
import { OrganizationController } from "../../modules/organization/organization.controller";
import { ExportsController } from "../../modules/reports/exports.controller";
import { PresetsController } from "../../modules/reports/presets.controller";
import { ReportsController } from "../../modules/reports/reports.controller";
import { RolesController } from "../../modules/roles/roles.controller";
import { SettingsController } from "../../modules/settings/settings.controller";
import { UsersController } from "../../modules/users/users.controller";
import { AUDITED_KEY } from "../decorators/audited.decorator";

// `never[]` (not `unknown[]`) so this is assignable *from* any real controller
// constructor regardless of its specific injected-dependency parameter types — these
// classes are only ever introspected via `.prototype`/`.name` here, never instantiated.
type Constructor = new (...args: never[]) => object;

// Explicit list, mirroring app.module.ts's own explicit module registration — a new
// controller must be added here deliberately, the same way it must be added to a
// module's `controllers` array. Filesystem globbing would silently skip this test for
// a controller nobody remembered to wire in either place.
const ALL_CONTROLLERS: Constructor[] = [
  AuthController,
  MeController,
  OrganizationController,
  AdminUnitsController,
  DashboardController,
  AccountsController,
  AllocationsController,
  ExpensesController,
  AttachmentsController,
  MonthCloseController,
  ReplenishmentsController,
  ReplenishmentRequestsController,
  ReportsController,
  ExportsController,
  PresetsController,
  UsersController,
  RolesController,
  SettingsController,
];

const MUTATING_METHODS = new Set<RequestMethod>([
  RequestMethod.POST,
  RequestMethod.PUT,
  RequestMethod.PATCH,
  RequestMethod.DELETE,
]);

// Genuinely unaudited today (Phase 8 finding, not fixed as part of this test) —
// personal per-user report-preset saves are not part of the financial audit trail.
const EXEMPTIONS: ReadonlySet<string> = new Set(["PresetsController.create", "PresetsController.remove"]);

interface MutatingRoute {
  controllerName: string;
  methodName: string;
}

function getHandler(controller: Constructor, methodName: string): ((...args: unknown[]) => unknown) | undefined {
  const handler = (controller.prototype as Record<string, unknown>)[methodName];
  return typeof handler === "function" ? (handler as (...args: unknown[]) => unknown) : undefined;
}

function findMutatingRoutes(controllers: Constructor[]): MutatingRoute[] {
  const routes: MutatingRoute[] = [];
  for (const controller of controllers) {
    const prototype = controller.prototype as Record<string, unknown>;
    for (const methodName of Object.getOwnPropertyNames(prototype)) {
      if (methodName === "constructor") continue;
      const handler = getHandler(controller, methodName);
      if (!handler) continue;
      const httpMethod = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      const hasPath = Reflect.getMetadata(PATH_METADATA, handler) !== undefined;
      if (hasPath && httpMethod !== undefined && MUTATING_METHODS.has(httpMethod)) {
        routes.push({ controllerName: controller.name, methodName });
      }
    }
  }
  return routes;
}

describe("audit coverage — every mutating route declares @Audited metadata", () => {
  it("has no undecorated mutating routes outside the documented exemptions", () => {
    const mutatingRoutes = findMutatingRoutes(ALL_CONTROLLERS);
    expect(mutatingRoutes.length).toBeGreaterThan(0); // sanity: the walk itself must find something

    const missing = mutatingRoutes.filter(({ controllerName, methodName }) => {
      if (EXEMPTIONS.has(`${controllerName}.${methodName}`)) return false;
      const controller = ALL_CONTROLLERS.find((c) => c.name === controllerName)!;
      const handler = getHandler(controller, methodName);
      return handler === undefined || Reflect.getMetadata(AUDITED_KEY, handler) === undefined;
    });

    if (missing.length > 0) {
      const list = missing.map(({ controllerName, methodName }) => `${controllerName}.${methodName}`).join(", ");
      expect.fail(`Mutating routes missing @Audited metadata: ${list}`);
    }
  });

  it("every EXEMPTIONS entry still exists and is genuinely mutating (guards against a stale allowlist)", () => {
    const mutatingRoutes = findMutatingRoutes(ALL_CONTROLLERS);
    const mutatingKeys = new Set(mutatingRoutes.map((r) => `${r.controllerName}.${r.methodName}`));
    for (const exemption of EXEMPTIONS) {
      expect(mutatingKeys.has(exemption)).toBe(true);
    }
  });
});
