import { Module } from "@nestjs/common";
import { OrganizationController } from "./organization.controller";
import { OrganizationRepository } from "./organization.repository";
import { OrganizationService } from "./organization.service";

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationRepository, OrganizationService],
})
export class OrganizationModule {}
