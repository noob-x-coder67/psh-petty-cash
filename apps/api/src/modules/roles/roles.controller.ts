import { Controller, Get } from "@nestjs/common";
import type { RolePermissionMatrix } from "@psh/contracts";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { RolesService } from "./roles.service";

// admin.manage_unit_access (Finance Manager + Super Admin) — both admin-capable roles
// should be able to see who's allowed to do what; this is a read-only view (Appendix A's
// role/permission grants are seeded data, changed via a reviewed seed/migration, not a
// live admin toggle — see the Administration plan's deferred "editable matrix" decision).
@Controller("admin/roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequiresPermission("admin.manage_unit_access")
  async getMatrix(): Promise<RolePermissionMatrix> {
    return this.rolesService.getMatrix();
  }
}
