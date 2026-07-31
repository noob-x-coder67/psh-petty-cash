import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  ConfirmAllocationRequestSchema,
  CreateAllocationRequestSchema,
  type Allocation,
  type ConfirmAllocationRequest,
  type CreateAllocationRequest,
} from "@psh/contracts";
import { Audited } from "../../common/decorators/audited.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { RequiresUnitScope } from "../../common/decorators/requires-unit-scope.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AllocationsService } from "./allocations.service";

@Controller("allocations")
export class AllocationsController {
  constructor(private readonly allocationsService: AllocationsService) {}

  @Get("pending/:unitId")
  @RequiresPermission("allocation.confirm_receipt")
  @RequiresUnitScope("param.unitId")
  async listPending(@Param("unitId") unitId: string, @CurrentUser() user: AuthenticatedUser): Promise<Allocation[]> {
    return this.allocationsService.listPending(unitId, user);
  }

  @Post()
  @RequiresPermission("allocation.record")
  @RequiresUnitScope("body.unitId")
  @Audited({ action: "ALLOCATION_CREATE", entityType: "cash_allocations" })
  async create(
    @Body(new ZodValidationPipe(CreateAllocationRequestSchema)) body: CreateAllocationRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Allocation> {
    return this.allocationsService.createAllocation({ ...body, issuer: user });
  }

  @Post(":id/confirm")
  @RequiresPermission("allocation.confirm_receipt")
  @RequiresUnitScope("derived")
  @Audited({ action: "ALLOCATION_CONFIRM", entityType: "cash_allocations" })
  async confirm(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ConfirmAllocationRequestSchema)) body: ConfirmAllocationRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Allocation> {
    return this.allocationsService.confirmAllocation({
      allocationId: id,
      confirmedDate: body.confirmedDate,
      confirmedBy: user,
    });
  }
}
