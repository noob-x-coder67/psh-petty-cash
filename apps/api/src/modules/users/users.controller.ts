import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import {
  AssignRoleRequestSchema,
  CreateUserRequestSchema,
  GrantUnitAccessRequestSchema,
  SetUserStatusRequestSchema,
  type AdminUser,
  type AssignRoleRequest,
  type CreateUserRequest,
  type CreateUserResult,
  type GrantUnitAccessRequest,
  type ResetPasswordResult,
  type SetUserStatusRequest,
} from "@psh/contracts";
import { Audited } from "../../common/decorators/audited.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { UsersService } from "./users.service";

// admin.manage_users_units (Super Admin only) gates account lifecycle: create,
// activate/deactivate, reset password. admin.manage_unit_access (Finance Manager +
// Super Admin) gates assigning roles/unit-access to EXISTING users — see
// prisma/seed-data.ts's split comment for the Appendix A "Limited" vs "Yes" reasoning.
@Controller("admin/users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequiresPermission("admin.manage_unit_access")
  async list(): Promise<AdminUser[]> {
    return this.usersService.listUsers();
  }

  @Post()
  @RequiresPermission("admin.manage_users_units")
  @Audited({ action: "USER_CREATE", entityType: "users" })
  async create(
    @Body(new ZodValidationPipe(CreateUserRequestSchema)) body: CreateUserRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreateUserResult> {
    return this.usersService.createUser(body, user);
  }

  @Patch(":id/status")
  @RequiresPermission("admin.manage_users_units")
  @Audited({ action: "USER_STATUS_CHANGE", entityType: "users" })
  async setStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(SetUserStatusRequestSchema)) body: SetUserStatusRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminUser> {
    return this.usersService.setUserActive(id, body.isActive, user);
  }

  @Post(":id/reset-password")
  @RequiresPermission("admin.manage_users_units")
  @Audited({ action: "USER_PASSWORD_RESET", entityType: "users" })
  async resetPassword(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser): Promise<ResetPasswordResult> {
    return this.usersService.resetPassword(id, user);
  }

  @Patch(":id/role")
  @RequiresPermission("admin.manage_unit_access")
  @Audited({ action: "USER_ROLE_CHANGE", entityType: "users" })
  async assignRole(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(AssignRoleRequestSchema)) body: AssignRoleRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminUser> {
    return this.usersService.assignRole(id, body.role, user);
  }

  @Post(":id/units")
  @RequiresPermission("admin.manage_unit_access")
  @Audited({ action: "USER_UNIT_ACCESS_GRANT", entityType: "user_unit_access" })
  async grantUnitAccess(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(GrantUnitAccessRequestSchema)) body: GrantUnitAccessRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminUser> {
    return this.usersService.grantUnitAccess(id, body.unitId, user);
  }

  @Delete(":id/units/:unitId")
  @RequiresPermission("admin.manage_unit_access")
  @Audited({ action: "USER_UNIT_ACCESS_REVOKE", entityType: "user_unit_access" })
  async revokeUnitAccess(
    @Param("id") id: string,
    @Param("unitId") unitId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminUser> {
    return this.usersService.revokeUnitAccess(id, unitId, user);
  }
}
