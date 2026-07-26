import { Module } from "@nestjs/common";
import { CommonModule } from "./common/common.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OrganizationModule } from "./modules/organization/organization.module";

@Module({
  imports: [CommonModule, HealthModule, AuthModule, OrganizationModule],
})
export class AppModule {}
