import "reflect-metadata";
import type { RequestMethod } from "@nestjs/common";

// Nest's own metadata keys for @Get/@Post/etc — normally imported from
// "@nestjs/common/constants" (as apps/api's audit-coverage.spec.ts does), but that
// subpath doesn't resolve here under this package's NodeNext moduleResolution (no
// "exports" map on @nestjs/common, and TS's scoped-package subpath lookup for a
// non-exports-mapped package behaves differently across workspace packages depending on
// symlink layout). These two string values are stable, well-known Nest internals
// (confirmed against the installed @nestjs/common@11.1.28 constants.js) — hardcoding them
// avoids fighting the resolver for a value that essentially never changes.
const PATH_METADATA = "path";
const METHOD_METADATA = "method";

// `never[]` (not `unknown[]`) so this is assignable *from* any real controller
// constructor regardless of its specific injected-dependency parameter types — these
// classes are only ever introspected via `.prototype`/`.name`, never instantiated.
// Same type used by apps/api's audit-coverage.spec.ts for the same reason.
export type Constructor = new (...args: never[]) => object;

export interface ControllerRoute {
  controllerName: string;
  methodName: string;
  controller: Constructor;
  handler: (...args: unknown[]) => unknown;
  httpMethod: RequestMethod;
}

function getHandler(controller: Constructor, methodName: string): ((...args: unknown[]) => unknown) | undefined {
  const handler = (controller.prototype as Record<string, unknown>)[methodName];
  return typeof handler === "function" ? (handler as (...args: unknown[]) => unknown) : undefined;
}

/** Walks every controller's prototype methods and returns the ones wired to an actual
 * HTTP route (carries both Nest's PATH_METADATA and METHOD_METADATA) — the shared walk
 * every controller-reflection test in apps/api builds on (audit coverage, the permission
 * matrix), so a new one doesn't reinvent this against Nest's internals independently. */
export function findControllerRoutes(controllers: Constructor[]): ControllerRoute[] {
  const routes: ControllerRoute[] = [];
  for (const controller of controllers) {
    const prototype = controller.prototype as Record<string, unknown>;
    for (const methodName of Object.getOwnPropertyNames(prototype)) {
      if (methodName === "constructor") continue;
      const handler = getHandler(controller, methodName);
      if (!handler) continue;
      const httpMethod = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      const hasPath = Reflect.getMetadata(PATH_METADATA, handler) !== undefined;
      if (hasPath && httpMethod !== undefined) {
        routes.push({ controllerName: controller.name, methodName, controller, handler, httpMethod });
      }
    }
  }
  return routes;
}

export interface RouteRequirement extends ControllerRoute {
  requiredPermission: string | undefined;
}

/** Per-route permission metadata for every controller route — the caller supplies its
 * own decorator's metadata key string (permissionMetadataKey) rather than this package
 * importing it from apps/api's decorator module: apps/api depends on @psh/testing (to
 * use this in its own tests), so the reverse import would be a circular package
 * dependency. This keeps the package a generic NestJS-reflection utility, not coupled to
 * one app's specific decorator implementation. */
export function buildPermissionMatrix(controllers: Constructor[], permissionMetadataKey: string): RouteRequirement[] {
  return findControllerRoutes(controllers).map((route) => ({
    ...route,
    requiredPermission: Reflect.getMetadata(permissionMetadataKey, route.handler) as string | undefined,
  }));
}
