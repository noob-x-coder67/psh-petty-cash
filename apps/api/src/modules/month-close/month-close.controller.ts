import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import {
  CloseMonthRequestSchema,
  RecordCashCountRequestSchema,
  ReopenMonthRequestSchema,
  type CloseMonthRequest,
  type MonthlyClosing,
  type RecordCashCountRequest,
  type ReopenMonthRequest,
} from "@psh/contracts";
import { Audited } from "../../common/decorators/audited.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { RequiresUnitScope } from "../../common/decorators/requires-unit-scope.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { MonthCloseService } from "./month-close.service";

@Controller("monthly-close")
export class MonthCloseController {
  constructor(private readonly monthCloseService: MonthCloseService) {}

  @Post()
  @RequiresPermission("cash_count.enter")
  @RequiresUnitScope("body.unitId")
  @Audited({ action: "MONTH_CLOSE_CASH_COUNT", entityType: "monthly_closings" })
  async recordCashCount(
    @Body(new ZodValidationPipe(RecordCashCountRequestSchema)) body: RecordCashCountRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MonthlyClosing> {
    return this.monthCloseService.recordCashCount({ ...body, actor: user });
  }

  // ADR-0007: dashboard.view_own_unit, not cash_count.enter — viewing status must stay
  // available to Finance Manager/Super Admin (who no longer hold cash_count.enter at
  // all) so they can still see a period and close it. Also picks up Unit In-Charge's
  // passive visibility and Auditor's read-only-all-units remit, both already granted
  // this same permission elsewhere.
  @Get(":unitId/:year/:month")
  @RequiresPermission("dashboard.view_own_unit")
  @RequiresUnitScope("param.unitId")
  async getClosing(
    @Param("unitId") unitId: string,
    @Param("year", ParseIntPipe) year: number,
    @Param("month", ParseIntPipe) month: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MonthlyClosing> {
    return this.monthCloseService.getClosing(unitId, year, month, user);
  }

  // ADR-0007: addressed by unit+period, not a row id — a period with no cash count ever
  // recorded has no MonthlyClosing row yet, and Finance Manager/Super Admin must still be
  // able to close it directly.
  @Post("close")
  @RequiresPermission("month.close")
  @RequiresUnitScope("body.unitId")
  @Audited({ action: "MONTH_CLOSE", entityType: "monthly_closings" })
  async close(
    @Body(new ZodValidationPipe(CloseMonthRequestSchema)) body: CloseMonthRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MonthlyClosing> {
    return this.monthCloseService.closeMonth(body.unitId, body.periodYear, body.periodMonth, user);
  }

  @Post(":id/reopen")
  @RequiresPermission("month.close")
  @RequiresUnitScope("derived")
  @Audited({ action: "MONTH_REOPEN", entityType: "monthly_closings" })
  async reopen(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ReopenMonthRequestSchema)) body: ReopenMonthRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MonthlyClosing> {
    return this.monthCloseService.reopenMonth(id, body.reason, user);
  }
}
