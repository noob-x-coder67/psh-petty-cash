import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { CreatePresetRequestSchema, type CreatePresetRequest, type ReportPreset } from "@psh/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PresetsService } from "./presets.service";

@Controller("reports/presets")
export class PresetsController {
  constructor(private readonly presetsService: PresetsService) {}

  @Post()
  @RequiresPermission("report.export")
  async create(
    @Body(new ZodValidationPipe(CreatePresetRequestSchema)) body: CreatePresetRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportPreset> {
    return this.presetsService.create(body, user);
  }

  @Get()
  @RequiresPermission("report.export")
  async list(
    @Query("reportKey") reportKey: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportPreset[]> {
    return this.presetsService.listForUser(user, reportKey);
  }

  @Delete(":id")
  @RequiresPermission("report.export")
  @HttpCode(204)
  async remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.presetsService.delete(id, user);
  }
}
