import { Module } from "@nestjs/common";
import { CommonModule } from "./common/common.module";
import { HealthModule } from "./health/health.module";
import { AccountsModule } from "./modules/accounts/accounts.module";
import { AllocationsModule } from "./modules/allocations/allocations.module";
import { AttachmentsModule } from "./modules/attachments/attachments.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { OrganizationModule } from "./modules/organization/organization.module";

@Module({
  imports: [
    CommonModule,
    HealthModule,
    AuthModule,
    OrganizationModule,
    AccountsModule,
    AllocationsModule,
    ExpensesModule,
    AttachmentsModule,
    DashboardModule,
  ],
})
export class AppModule {}
