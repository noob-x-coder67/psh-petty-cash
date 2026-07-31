import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  ConfirmReplenishmentRequestSchema,
  type ComplianceResponse,
  type ConfirmReplenishmentRequest,
  type Replenishment,
} from "@psh/contracts";
import { Audited } from "../../common/decorators/audited.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { RequiresUnitScope } from "../../common/decorators/requires-unit-scope.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { ReplenishmentsService } from "./replenishments.service";

// ADR-0010: direct-create is gone — a Replenishment row is only ever produced by
// ReplenishmentRequestsController's approve/override routes. This controller now only
// covers the parts of the flow that didn't change: hand-to-hand confirm receipt
// (ADR-0009) and the compliance timeline.
@Controller()
export class ReplenishmentsController {
  constructor(private readonly replenishmentsService: ReplenishmentsService) {}

  @Post("replenishments/:id/confirm")
  @RequiresPermission("allocation.confirm_receipt")
  @RequiresUnitScope("derived")
  @Audited({ action: "REPLENISHMENT_CONFIRM", entityType: "replenishments" })
  async confirm(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ConfirmReplenishmentRequestSchema)) body: ConfirmReplenishmentRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Replenishment> {
    return this.replenishmentsService.confirmReplenishment(id, body, user);
  }

  @Get("replenishments/pending/:unitId")
  @RequiresPermission("allocation.confirm_receipt")
  @RequiresUnitScope("param.unitId")
  async listPending(@Param("unitId") unitId: string, @CurrentUser() user: AuthenticatedUser): Promise<Replenishment[]> {
    return this.replenishmentsService.listPending(unitId, user);
  }

  @Get("compliance/:unitId")
  @RequiresPermission("dashboard.view_own_unit")
  @RequiresUnitScope("param.unitId")
  async compliance(
    @Param("unitId") unitId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ComplianceResponse> {
    return this.replenishmentsService.getCompliance(unitId, user);
  }
}
