import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import {
  RecordCashCountRequestSchema,
  ReopenMonthRequestSchema,
  type MonthlyClosing,
  type RecordCashCountRequest,
  type ReopenMonthRequest,
} from "@psh/contracts";
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
  async recordCashCount(
    @Body(new ZodValidationPipe(RecordCashCountRequestSchema)) body: RecordCashCountRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MonthlyClosing> {
    return this.monthCloseService.recordCashCount({ ...body, actor: user });
  }

  @Get(":unitId/:year/:month")
  @RequiresPermission("cash_count.enter")
  @RequiresUnitScope("param.unitId")
  async getClosing(
    @Param("unitId") unitId: string,
    @Param("year", ParseIntPipe) year: number,
    @Param("month", ParseIntPipe) month: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MonthlyClosing> {
    return this.monthCloseService.getClosing(unitId, year, month, user);
  }

  @Post(":id/close")
  @RequiresPermission("month.close")
  @RequiresUnitScope("derived")
  async close(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser): Promise<MonthlyClosing> {
    return this.monthCloseService.closeMonth(id, user);
  }

  @Post(":id/reopen")
  @RequiresPermission("month.close")
  @RequiresUnitScope("derived")
  async reopen(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ReopenMonthRequestSchema)) body: ReopenMonthRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MonthlyClosing> {
    return this.monthCloseService.reopenMonth(id, body.reason, user);
  }
}
