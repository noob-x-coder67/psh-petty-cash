import { Controller, Get, Param, Post } from "@nestjs/common";
import type { PettyCashAccount } from "@prisma/client";
import { Audited } from "../../common/decorators/audited.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { RequiresUnitScope } from "../../common/decorators/requires-unit-scope.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AccountsService } from "./accounts.service";

@Controller("accounts")
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post(":unitId")
  // Enabling petty cash for an already-existing unit is an operational access decision
  // (who gets petty cash), not user lifecycle or unit definition — stays under the
  // Finance-Manager-accessible key even after the admin.manage_users_units/
  // admin.manage_unit_access split (see prisma/seed-data.ts).
  @RequiresPermission("admin.manage_unit_access")
  @RequiresUnitScope("param.unitId")
  @Audited({ action: "ACCOUNT_ENABLE", entityType: "petty_cash_accounts" })
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
