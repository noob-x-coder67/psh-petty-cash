import { Body, Controller, Param, Post } from "@nestjs/common";
import {
  ConfirmAllocationRequestSchema,
  CreateAllocationRequestSchema,
  type ConfirmAllocationRequest,
  type CreateAllocationRequest,
} from "@psh/contracts";
import type { CashAllocation } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { RequiresUnitScope } from "../../common/decorators/requires-unit-scope.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AllocationsService } from "./allocations.service";

@Controller("allocations")
export class AllocationsController {
  constructor(private readonly allocationsService: AllocationsService) {}

  @Post()
  @RequiresPermission("allocation.record")
  @RequiresUnitScope("body.unitId")
  async create(
    @Body(new ZodValidationPipe(CreateAllocationRequestSchema)) body: CreateAllocationRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CashAllocation> {
    return this.allocationsService.createAllocation({ ...body, issuer: user });
  }

  @Post(":id/confirm")
  @RequiresPermission("allocation.confirm_receipt")
  @RequiresUnitScope("derived")
  async confirm(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ConfirmAllocationRequestSchema)) body: ConfirmAllocationRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CashAllocation> {
    return this.allocationsService.confirmAllocation({
      allocationId: id,
      confirmedAmount: body.confirmedAmount,
      confirmedDate: body.confirmedDate,
      confirmedBy: user,
    });
  }
}
