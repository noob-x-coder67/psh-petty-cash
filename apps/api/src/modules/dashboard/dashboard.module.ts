import { Module } from "@nestjs/common";
import { AccountsModule } from "../accounts/accounts.module";
import { MonthCloseModule } from "../month-close/month-close.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardRepository } from "./dashboard.repository";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [AccountsModule, MonthCloseModule],
  controllers: [DashboardController],
  providers: [DashboardRepository, DashboardService],
})
export class DashboardModule {}
