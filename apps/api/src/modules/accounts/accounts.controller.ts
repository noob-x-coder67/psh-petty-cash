import { Controller, Get, Param, Post } from "@nestjs/common";
import type { PettyCashAccount } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { RequiresUnitScope } from "../../common/decorators/requires-unit-scope.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AccountsService } from "./accounts.service";

@Controller("accounts")
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post(":unitId")
  @RequiresPermission("admin.manage_users_units")
  @RequiresUnitScope("param.unitId")
  async enable(
    @Param("unitId") unitId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PettyCashAccount> {
    return this.accountsService.enableAccount(unitId, user);
  }

  @Get(":id")
  @RequiresPermission("dashboard.view_own_unit")
  @RequiresUnitScope("derived")
  async get(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser): Promise<PettyCashAccount> {
    return this.accountsService.getAccountForUser(id, user);
  }
}
