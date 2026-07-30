import { Module } from "@nestjs/common";
import { AdminUnitsController } from "./admin-units.controller";
import { OrganizationController } from "./organization.controller";
import { OrganizationRepository } from "./organization.repository";
import { OrganizationService } from "./organization.service";

@Module({
  controllers: [OrganizationController, AdminUnitsController],
  providers: [OrganizationRepository, OrganizationService],
  exports: [OrganizationRepository],
})
export class OrganizationModule {}
