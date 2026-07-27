import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RoleKey } from "@prisma/client";
import type { Request } from "express";
import { REQUIRES_PERMISSION_KEY } from "../decorators/requires-permission.decorator";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthenticatedUser } from "../types/authenticated-user";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleKey[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermission = this.reflector.getAllAndOverride<string | undefined>(REQUIRES_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles && !requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException("No authenticated user on request");
    }

    if (requiredRoles && !requiredRoles.some((role) => user.roleKeys.includes(role))) {
      throw new ForbiddenException("Role not permitted for this action");
    }

    if (requiredPermission && !user.permissionKeys.includes(requiredPermission)) {
      throw new ForbiddenException("Permission not granted for this action");
    }

    return true;
  }
}
