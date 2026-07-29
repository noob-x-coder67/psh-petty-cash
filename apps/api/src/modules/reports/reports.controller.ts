import { Controller, ForbiddenException, Get, Param, Query } from "@nestjs/common";
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
  // separate capability. RPT-14 additionally requires audit.view — this is a single
  // shared route for all 16 reports, so a per-report permission difference has to be an
  // in-method check rather than a second route-level decorator. audit.view's seeded role
  // set (Unit In-Charge, Finance Officer, Finance Manager, Super Admin, Auditor) is a
  // strict subset of report.export's, so this only tightens access for Unit User, who
  // could otherwise see every audit_logs row via this route.
  @Get(":reportKey")
  @RequiresPermission("report.export")
  @RequiresUnitScope("derived")
  async getReport(
    @Param("reportKey", new ZodValidationPipe(ReportKeySchema)) reportKey: ReportKey,
    @Query("filters") filtersRaw: string | undefined,
    @Query("cursorOccurredAt") cursorOccurredAt: string | undefined,
    @Query("cursorId") cursorId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportDatasetResponse> {
    if (reportKey === "RPT-14" && !user.permissionKeys.includes("audit.view")) {
      throw new ForbiddenException("audit.view permission required to view the audit trail");
    }
    const filter = parseFiltersQuery(filtersRaw);
    const auditCursor = cursorOccurredAt && cursorId ? { occurredAt: new Date(cursorOccurredAt), id: cursorId } : undefined;
    return this.reportsService.getReport(reportKey, filter, user, auditCursor);
  }
}
