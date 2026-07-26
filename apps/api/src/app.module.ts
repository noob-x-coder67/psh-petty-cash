import { Module } from "@nestjs/common";
import { CommonModule } from "./common/common.module";
import { HealthModule } from "./health/health.module";
import { AccountsModule } from "./modules/accounts/accounts.module";
import { AllocationsModule } from "./modules/allocations/allocations.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OrganizationModule } from "./modules/organization/organization.module";

@Module({
  imports: [CommonModule, HealthModule, AuthModule, OrganizationModule, AccountsModule, AllocationsModule],
})
export class AppModule {}
