import { Controller, Get } from "@nestjs/common";
import type { OrganizationalUnit } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { RequiresUnitScope } from "../../common/decorators/requires-unit-scope.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { OrganizationService } from "./organization.service";

@Controller("units")
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @RequiresPermission("dashboard.view_own_unit")
  @RequiresUnitScope("derived")
  async list(@CurrentUser() user: AuthenticatedUser): Promise<OrganizationalUnit[]> {
    return this.organizationService.listAuthorizedUnits(user);
  }
}
