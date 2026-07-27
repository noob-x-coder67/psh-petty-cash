import { Module } from "@nestjs/common";
import { StorageModule } from "../../storage/storage.module";
import { MonthCloseModule } from "../month-close/month-close.module";
import { ExportsController } from "./exports.controller";
import { ExportsRepository } from "./exports.repository";
import { ExportsService } from "./exports.service";
import { PresetsController } from "./presets.controller";
import { PresetsRepository } from "./presets.repository";
import { PresetsService } from "./presets.service";
import { ReportsController } from "./reports.controller";
import { ReportsRepository } from "./reports.repository";
import { ReportsService } from "./reports.service";

@Module({
  imports: [StorageModule, MonthCloseModule],
  // PresetsController (a literal "reports/presets" path) must be registered before
  // ReportsController — Express/Nest matches routes in registration order, and
  // ReportsController's GET /reports/:reportKey would otherwise swallow GET /reports/
  // presets first, with "presets" rejected by ZodValidationPipe as an invalid ReportKey.
  controllers: [PresetsController, ReportsController, ExportsController],
  providers: [
    ReportsRepository,
    ReportsService,
    ExportsRepository,
    ExportsService,
    PresetsRepository,
    PresetsService,
  ],
})
export class ReportsModule {}
