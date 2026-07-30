import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import type { OrganizationalUnit } from "@prisma/client";
import { CreateUnitRequestSchema, UpdateUnitRequestSchema, type CreateUnitRequest, type UpdateUnitRequest } from "@psh/contracts";
import { Audited } from "../../common/decorators/audited.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { OrganizationService } from "./organization.service";

// admin.manage_users_units (Super Admin only) — SRS §6.1 lists "units" among Super
// Admin's responsibilities, not Finance Manager's; Appendix A's "Limited" grant for
// Finance Manager is entirely about user/access assignment (see UsersController), not
// unit definitions. A separate controller from OrganizationController (@Controller
// "units") because Nest route prefixes can't be escaped from within one controller —
// same reason MonthCloseController/ReplenishmentsController are two classes sharing
// one module.
@Controller("admin/units")
export class AdminUnitsController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @RequiresPermission("admin.manage_users_units")
  async list(): Promise<OrganizationalUnit[]> {
    return this.organizationService.listAllForAdmin();
  }

  @Post()
  @RequiresPermission("admin.manage_users_units")
  @Audited({ action: "UNIT_CREATE", entityType: "organizational_units" })
  async create(
    @Body(new ZodValidationPipe(CreateUnitRequestSchema)) body: CreateUnitRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrganizationalUnit> {
    return this.organizationService.createUnit(body, user);
  }

  @Patch(":id")
  @RequiresPermission("admin.manage_users_units")
  @Audited({ action: "UNIT_UPDATE", entityType: "organizational_units" })
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateUnitRequestSchema)) body: UpdateUnitRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrganizationalUnit> {
    return this.organizationService.updateUnit(id, body, user);
  }
}
