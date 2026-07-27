import { Controller, Get, Param } from "@nestjs/common";
import type { DashboardFinanceResponse, DashboardUnitResponse } from "@psh/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { RequiresUnitScope } from "../../common/decorators/requires-unit-scope.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("finance")
  @RequiresPermission("dashboard.view_all")
  @RequiresUnitScope("derived")
  async finance(@CurrentUser() user: AuthenticatedUser): Promise<DashboardFinanceResponse> {
    return this.dashboardService.getFinanceDashboard(user);
  }

  @Get("unit/:id")
  @RequiresPermission("dashboard.view_own_unit")
  @RequiresUnitScope("derived")
  async unit(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser): Promise<DashboardUnitResponse> {
    return this.dashboardService.getUnitDashboard(id, user);
  }
}
