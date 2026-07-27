import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { REQUIRES_UNIT_SCOPE_KEY, type UnitScopeSource } from "../decorators/requires-unit-scope.decorator";
import type { AuthenticatedUser } from "../types/authenticated-user";

@Injectable()
export class UnitScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const source = this.reflector.getAllAndOverride<UnitScopeSource | undefined>(REQUIRES_UNIT_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!source) {
      return true;
    }

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

    const [location, field] = source.split(".") as ["param" | "body", string];
    const targetUnitId =
      location === "param"
        ? request.params[field]
        : (request.body as Record<string, unknown> | undefined)?.[field];

    if (typeof targetUnitId !== "string") {
      throw new ForbiddenException(`Missing unit identifier at ${source}`);
    }

    if (!user.unitScope.all && !user.unitScope.unitIds.includes(targetUnitId)) {
      throw new ForbiddenException("Unit is outside your authorized scope");
    }

    return true;
  }
}
