import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  ApproveReplenishmentRequestSchema,
  RejectReplenishmentRequestSchema,
  SubmitReplenishmentOverrideSchema,
  SubmitReplenishmentRequestSchema,
  type ApproveReplenishmentRequest,
  type RejectReplenishmentRequest,
  type ReplenishmentRequest,
  type SubmitReplenishmentOverride,
  type SubmitReplenishmentRequest,
} from "@psh/contracts";
import { Audited } from "../../common/decorators/audited.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { RequiresUnitScope } from "../../common/decorators/requires-unit-scope.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { ReplenishmentRequestsService } from "./replenishment-requests.service";

// ADR-0010: Replenishment Request -> Approve -> Confirm. Submit/list-own are the unit's
// own capability (replenishment.request); the approval queue/approve/reject/override
// are Finance's (replenishment.approve, and additionally
// compliance.override_three_month_hold for the override route specifically).
@Controller("replenishment-requests")
export class ReplenishmentRequestsController {
  constructor(private readonly replenishmentRequestsService: ReplenishmentRequestsService) {}

  @Post()
  @RequiresPermission("replenishment.request")
  @RequiresUnitScope("body.unitId")
  @Audited({ action: "REPLENISHMENT_REQUEST_SUBMIT", entityType: "replenishment_requests" })
  async submit(
    @Body(new ZodValidationPipe(SubmitReplenishmentRequestSchema)) body: SubmitReplenishmentRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReplenishmentRequest> {
    return this.replenishmentRequestsService.submitRequest({ ...body, actor: user });
  }

  @Post("override")
  @RequiresPermission("compliance.override_three_month_hold")
  @RequiresUnitScope("body.unitId")
  @Audited({ action: "REPLENISHMENT_REQUEST_OVERRIDE", entityType: "replenishment_requests" })
  async override(
    @Body(new ZodValidationPipe(SubmitReplenishmentOverrideSchema)) body: SubmitReplenishmentOverride,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReplenishmentRequest> {
    return this.replenishmentRequestsService.submitOverride({ ...body, actor: user });
  }

  @Get("pending")
  @RequiresPermission("replenishment.approve")
  @RequiresUnitScope("derived")
  async pending(@CurrentUser() user: AuthenticatedUser): Promise<ReplenishmentRequest[]> {
    return this.replenishmentRequestsService.listPending(user);
  }

  @Get("unit/:unitId")
  @RequiresPermission("replenishment.request")
  @RequiresUnitScope("param.unitId")
  async forUnit(
    @Param("unitId") unitId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReplenishmentRequest[]> {
    return this.replenishmentRequestsService.listForUnit(unitId, user);
  }

  @Post(":id/approve")
  @RequiresPermission("replenishment.approve")
  @RequiresUnitScope("derived")
  @Audited({ action: "REPLENISHMENT_REQUEST_APPROVE", entityType: "replenishment_requests" })
  async approve(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ApproveReplenishmentRequestSchema)) body: ApproveReplenishmentRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReplenishmentRequest> {
    return this.replenishmentRequestsService.approve(id, body, user);
  }

  @Post(":id/reject")
  @RequiresPermission("replenishment.approve")
  @RequiresUnitScope("derived")
  @Audited({ action: "REPLENISHMENT_REQUEST_REJECT", entityType: "replenishment_requests" })
  async reject(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(RejectReplenishmentRequestSchema)) body: RejectReplenishmentRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReplenishmentRequest> {
    return this.replenishmentRequestsService.reject(id, body, user);
  }
}
