import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import {
  ALL_UNITS_SCOPE_VALUE,
  REQUIRES_UNIT_SCOPE_KEY,
  type UnitScopeMetadata,
  type UnitScopeRequirement,
} from "../decorators/requires-unit-scope.decorator";
import type { AuthenticatedUser } from "../types/authenticated-user";

@Injectable()
export class UnitScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const metadata = this.reflector.getAllAndOverride<UnitScopeMetadata | undefined>(
      REQUIRES_UNIT_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!metadata) {
      return true;
    }
    const requirement: UnitScopeRequirement =
      typeof metadata === "string" ? { source: metadata } : metadata;
    const { source } = requirement;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException("No authenticated user on request");
    }

    if (source === "derived") {
      // Nothing to check here — the service/repository applies user.unitScope itself
      // as a filter (Build Plan §3.3: "every list query receives a scopeFilter").
      return true;
    }

    const [location, field] = source.split(".") as ["param" | "body" | "query", string];
    const targetUnitId = (() => {
      if (location === "param") return request.params[field];
      if (location === "body")
        return (request.body as Record<string, unknown> | undefined)?.[field];
      return (request.query as Record<string, unknown> | undefined)?.[field];
    })();

    if (typeof targetUnitId !== "string") {
      throw new ForbiddenException(`Missing unit identifier at ${source}`);
    }

    // An aggregate sentinel is never treated like an arbitrary concrete unit id. The
    // route must explicitly opt into it, and the authenticated context must satisfy
    // both independent gates: all-unit scope and the route's aggregate permission.
    // This runs in the global guard before controller pipes or repository access.
    if (requirement.allowAll?.value === targetUnitId) {
      if (!user.unitScope.all || !user.permissionKeys.includes(requirement.allowAll.permission)) {
        throw new ForbiddenException("All-units scope is not permitted for this action");
      }
      return true;
    }

    // Reserve every configured aggregate sentinel for the explicit branch above. A
    // broad-scope caller cannot smuggle it through a route that didn't opt into all.
    if (targetUnitId === ALL_UNITS_SCOPE_VALUE) {
      throw new ForbiddenException("All-units scope is not permitted for this action");
    }

    if (!user.unitScope.all && !user.unitScope.unitIds.includes(targetUnitId)) {
      throw new ForbiddenException("Unit is outside your authorized scope");
    }

    return true;
  }
}
