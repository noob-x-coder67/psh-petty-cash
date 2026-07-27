import { Module } from "@nestjs/common";
import { AccountsModule } from "../accounts/accounts.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardRepository } from "./dashboard.repository";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [AccountsModule],
  controllers: [DashboardController],
  providers: [DashboardRepository, DashboardService],
})
export class DashboardModule {}
