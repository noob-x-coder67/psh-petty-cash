import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  BulkCheckRequestSchema,
  CreateVoucherRequestSchema,
  EditVoucherRequestSchema,
  ReverseVoucherRequestSchema,
  UncheckVoucherRequestSchema,
  type BulkCheckRequest,
  type CreateVoucherRequest,
  type EditVoucherRequest,
  type ReverseVoucherRequest,
  type UncheckVoucherRequest,
} from "@psh/contracts";
import type { ExpenseVoucher } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { RequiresUnitScope } from "../../common/decorators/requires-unit-scope.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import type { CreateVoucherResult } from "./expenses.service";
import { ExpensesService } from "./expenses.service";
import type { ExpenseVoucherWithLines, VoucherListFilters } from "./expenses.repository";

@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @RequiresPermission("expense.create")
  @RequiresUnitScope("body.unitId")
  async create(
    @Body(new ZodValidationPipe(CreateVoucherRequestSchema)) body: CreateVoucherRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreateVoucherResult> {
    return this.expensesService.createVoucher({ ...body, enteredBy: user });
  }

  @Get()
  @RequiresPermission("dashboard.view_own_unit")
  @RequiresUnitScope("derived")
  async list(
    @Query("unitId") unitId: string,
    @Query("cursorDate") cursorDate: string | undefined,
    @Query("cursorId") cursorId: string | undefined,
    @Query("q") search: string | undefined,
    @Query("checked") checked: string | undefined,
    @Query("category") category: string | undefined,
    @Query("dateFrom") dateFrom: string | undefined,
    @Query("dateTo") dateTo: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExpenseVoucherWithLines[]> {
    const filters: VoucherListFilters = {
      search: search || undefined,
      checked: checked === "true" ? true : checked === "false" ? false : undefined,
      category:
        category === "BUILDING" || category === "VEHICLE" || category === "OTHER" ? category : undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    };
    return this.expensesService.listVouchersForUser(
      unitId,
      user,
      filters,
      cursorDate && cursorId ? { expenseDate: cursorDate, id: cursorId } : undefined,
    );
  }

  @Get(":id")
  @RequiresPermission("dashboard.view_own_unit")
  @RequiresUnitScope("derived")
  async get(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExpenseVoucherWithLines> {
    return this.expensesService.getVoucherForUser(id, user);
  }

  @Patch(":id")
  @RequiresPermission("expense.edit_saved")
  @RequiresUnitScope("derived")
  async edit(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(EditVoucherRequestSchema)) body: EditVoucherRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExpenseVoucher> {
    return this.expensesService.editVoucher({ voucherId: id, ...body, actor: user });
  }

  @Post(":id/reverse")
  @RequiresPermission("expense.edit_saved")
  @RequiresUnitScope("derived")
  async reverse(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ReverseVoucherRequestSchema)) body: ReverseVoucherRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExpenseVoucher> {
    return this.expensesService.reverseVoucher({ voucherId: id, reason: body.reason, actor: user });
  }

  @Post(":id/check")
  @RequiresPermission("receipt.check")
  @RequiresUnitScope("derived")
  async check(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser): Promise<ExpenseVoucher> {
    return this.expensesService.checkVoucher(id, user);
  }

  @Post(":id/uncheck")
  @RequiresPermission("receipt.check")
  @RequiresUnitScope("derived")
  async uncheck(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UncheckVoucherRequestSchema)) body: UncheckVoucherRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExpenseVoucher> {
    return this.expensesService.uncheckVoucher(id, body.reason, user);
  }

  @Post("bulk-check")
  @RequiresPermission("receipt.check")
  @RequiresUnitScope("derived")
  async bulkCheck(
    @Body(new ZodValidationPipe(BulkCheckRequestSchema)) body: BulkCheckRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ checked: string[]; skipped: string[] }> {
    return this.expensesService.bulkCheckVouchers(body.voucherIds, user);
  }
}
