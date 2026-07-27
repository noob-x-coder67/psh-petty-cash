import { Body, Controller, Get, Param, Post, Res, StreamableFile } from "@nestjs/common";
import { CreateExportRequestSchema, type CreateExportRequest, type ExportStatusResponse } from "@psh/contracts";
import type { Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { ExportsService } from "./exports.service";

@Controller("exports")
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  // No @RequiresUnitScope here — an export's filters can span several units, so there's
  // no single unit param to check at the guard level. Ownership (Appendix A's "Own" vs
  // "All") is enforced inside ExportsService.assertOwnership instead.
  @Post()
  @RequiresPermission("report.export")
  async create(
    @Body(new ZodValidationPipe(CreateExportRequestSchema)) body: CreateExportRequest,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExportStatusResponse> {
    return this.exportsService.createExport({ ...body, actor: user });
  }

  @Get(":id")
  @RequiresPermission("report.export")
  async status(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser): Promise<ExportStatusResponse> {
    return this.exportsService.getStatus(id, user);
  }

  @Get(":id/download")
  @RequiresPermission("report.export")
  async download(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, fileName, mimeType } = await this.exportsService.download(id, user);
    res.set({
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "X-Content-Type-Options": "nosniff",
    });
    return new StreamableFile(stream);
  }
}
