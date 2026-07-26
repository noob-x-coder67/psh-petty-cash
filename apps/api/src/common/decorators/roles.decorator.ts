import { SetMetadata, type CustomDecorator } from "@nestjs/common";
import type { RoleKey } from "@prisma/client";

export const ROLES_KEY = "roles";

/** Restricts a route to users holding at least one of the given role_key values. */
export const Roles = (...roles: RoleKey[]): CustomDecorator<string> => SetMetadata(ROLES_KEY, roles);
