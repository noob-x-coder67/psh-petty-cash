import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from "@nestjs/common";
import type { ExpenseCategory as PrismaExpenseCategory } from "@prisma/client";
import {
  CreateExpenseCategoryRequestSchema,
  ReorderExpenseCategoriesRequestSchema,
  UpdateExpenseCategoryRequestSchema,
  type CreateExpenseCategoryRequest,
  type ReorderExpenseCategoriesRequest,
  type UpdateExpenseCategoryRequest,
} from "@psh/contracts";
import { Audited } from "../../common/decorators/audited.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CategoriesService } from "./categories.service";

@Controller("expense-categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // All authenticated expense/report users need category labels. Inactive rows are
  // readable on request so historical filters never become unresolvable.
  @Get()
  async list(@Query("includeInactive") includeInactive: string | undefined): Promise<PrismaExpenseCategory[]> {
    return this.categoriesService.list(includeInactive === "true");
  }
}

@Controller("admin/categories")
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @RequiresPermission("category.manage")
  async list(): Promise<PrismaExpenseCategory[]> {
    return this.categoriesService.list(true);
  }

  @Post()
  @RequiresPermission("category.manage")
  @Audited({ action: "CATEGORY_CREATE", entityType: "expense_categories" })
  async create(
    @Body(new ZodValidationPipe(CreateExpenseCategoryRequestSchema))
    body: CreateExpenseCategoryRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PrismaExpenseCategory> {
    return this.categoriesService.create(body, user);
  }

  @Patch(":id")
  @RequiresPermission("category.manage")
  @Audited({ action: "CATEGORY_UPDATE", entityType: "expense_categories" })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateExpenseCategoryRequestSchema))
    body: UpdateExpenseCategoryRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PrismaExpenseCategory> {
    return this.categoriesService.update(id, body, user);
  }

  @Put("order")
  @RequiresPermission("category.manage")
  @Audited({ action: "CATEGORY_REORDER", entityType: "expense_categories" })
  async reorder(
    @Body(new ZodValidationPipe(ReorderExpenseCategoriesRequestSchema))
    body: ReorderExpenseCategoriesRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PrismaExpenseCategory[]> {
    return this.categoriesService.reorder(body, user);
  }

  @Put("order/alphabetical")
  @RequiresPermission("category.manage")
  @Audited({ action: "CATEGORY_REORDER", entityType: "expense_categories" })
  async restoreAlphabetical(@CurrentUser() user: AuthenticatedUser): Promise<PrismaExpenseCategory[]> {
    return this.categoriesService.restoreAlphabetical(user);
  }
}
