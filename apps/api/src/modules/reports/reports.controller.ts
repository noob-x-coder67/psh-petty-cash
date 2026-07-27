import { Controller, Get, Param, Query } from "@nestjs/common";
import { ReportKeySchema, type ReportDatasetResponse, type ReportKey } from "@psh/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequiresPermission } from "../../common/decorators/requires-permission.decorator";
import { RequiresUnitScope } from "../../common/decorators/requires-unit-scope.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { parseFiltersQuery } from "./reports.filters";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // report.export is the only reports permission Appendix A defines (Own for Center
  // User/In-Charge, All for Finance/Auditor/Super Admin) — it gates both the on-screen
  // preview and the export job, since previewing is a prerequisite of exporting, not a
  // separate capability.
  @Get(":reportKey")
  @RequiresPermission("report.export")
  @RequiresUnitScope("derived")
  async getReport(
    @Param("reportKey", new ZodValidationPipe(ReportKeySchema)) reportKey: ReportKey,
    @Query("filters") filtersRaw: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportDatasetResponse> {
    const filter = parseFiltersQuery(filtersRaw);
    return this.reportsService.getReport(reportKey, filter, user);
  }
}
