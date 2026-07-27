import { Injectable } from "@nestjs/common";
import type { OrganizationalUnit } from "@prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { OrganizationRepository } from "./organization.repository";

@Injectable()
export class OrganizationService {
  constructor(private readonly organizationRepository: OrganizationRepository) {}

  async listAuthorizedUnits(user: AuthenticatedUser): Promise<OrganizationalUnit[]> {
    return this.organizationRepository.findAuthorizedUnits(user.unitScope);
  }
}
