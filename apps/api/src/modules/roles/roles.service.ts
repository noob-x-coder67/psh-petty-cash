import { Injectable } from "@nestjs/common";
import type { RolePermissionMatrix } from "@psh/contracts";
import { RolesRepository } from "./roles.repository";

// Seeded permission keys that no route anywhere in apps/api actually checks via
// @RequiresPermission or an equivalent service-layer guard — confirmed by grepping
// every controller for each key in prisma/seed-data.ts's PERMISSIONS list. Appendix A
// grants these to a role, but they gate nothing today. Same "documented, reviewed
// exception list" shape as audit-coverage.spec.ts's EXEMPTIONS — if one of these is
// ever wired up to a real route, remove it here rather than leaving it stale.
const UNENFORCED_PERMISSIONS: ReadonlySet<string> = new Set(["category.manage"]);

@Injectable()
export class RolesService {
  constructor(private readonly rolesRepository: RolesRepository) {}

  async getMatrix(): Promise<RolePermissionMatrix> {
    const [roles, permissions, grants] = await Promise.all([
      this.rolesRepository.listRoles(),
      this.rolesRepository.listPermissions(),
      this.rolesRepository.listGrants(),
    ]);

    const roleKeyById = new Map(roles.map((role) => [role.id, role.key]));
    const permissionKeyById = new Map(permissions.map((permission) => [permission.id, permission.key]));

    return {
      roles: roles.map((role) => ({ key: role.key, name: role.name })),
      permissions: permissions.map((permission) => ({
        key: permission.key,
        description: permission.description,
        enforced: !UNENFORCED_PERMISSIONS.has(permission.key),
      })),
      // roleId/permissionId -> key lookups: grants are stored by FK, but the contract
      // (and the frontend matrix table) key off the stable, human-legible role/permission
      // keys, not internal UUIDs. Both maps are guaranteed populated for every grant row
      // by the role_permissions FK constraints, so no fallback/filtering is needed here.
      grants: grants.map((grant) => ({
        roleKey: roleKeyById.get(grant.roleId)!,
        permissionKey: permissionKeyById.get(grant.permissionId)!,
      })),
    };
  }
}
