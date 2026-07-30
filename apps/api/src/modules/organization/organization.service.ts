import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { OrganizationalUnit } from "@prisma/client";
import type { CreateUnitRequest, UpdateUnitRequest } from "@psh/contracts";
import { AuditLogRepository } from "../../common/audit/audit-log.repository";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { OrganizationRepository } from "./organization.repository";
import { isPettyCashEnableAllowed } from "./organization.rules";

@Injectable()
export class OrganizationService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly prisma: PrismaService,
  ) {}

  async listAuthorizedUnits(user: AuthenticatedUser): Promise<OrganizationalUnit[]> {
    return this.organizationRepository.findAuthorizedUnits(user.unitScope);
  }

  async listAllForAdmin(): Promise<OrganizationalUnit[]> {
    return this.organizationRepository.listAllForAdmin();
  }

  async createUnit(input: CreateUnitRequest, actor: AuthenticatedUser): Promise<OrganizationalUnit> {
    // BR-016 checked before uniqueness deliberately: code PSH-ISB always already exists
    // post-seed, so a create attempt with pettyCashEnabled:true would otherwise only
    // ever surface as a generic 409 "already in use" — checking the business-rule
    // violation first surfaces the actually-relevant reason.
    if (!isPettyCashEnableAllowed(input.code, input.pettyCashEnabled)) {
      throw new BadRequestException("PSH-ISB cannot have petty cash enabled");
    }
    const existing = await this.organizationRepository.findByCode(input.code);
    if (existing) {
      throw new ConflictException(`Unit code ${input.code} is already in use`);
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await this.organizationRepository.create(input, tx);
      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "UNIT_CREATE",
        entityType: "organizational_units",
        entityId: created.id,
        unitId: created.id,
        after: created,
      });
      return created;
    });
  }

  async updateUnit(id: string, input: UpdateUnitRequest, actor: AuthenticatedUser): Promise<OrganizationalUnit> {
    const before = await this.organizationRepository.findById(id);
    if (!before) {
      throw new NotFoundException(`Unit ${id} not found`);
    }
    // input.pettyCashEnabled undefined means "not being changed" — fall back to the
    // existing value so a PATCH to an unrelated field on PSH-ISB (e.g. just city) can't
    // be misread as an attempt to enable it.
    const nextPettyCashEnabled = input.pettyCashEnabled ?? before.pettyCashEnabled;
    if (!isPettyCashEnableAllowed(before.code, nextPettyCashEnabled)) {
      throw new BadRequestException("PSH-ISB cannot have petty cash enabled");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.organizationRepository.update(id, input, tx);
      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "UNIT_UPDATE",
        entityType: "organizational_units",
        entityId: id,
        unitId: id,
        before,
        after: updated,
      });
      return updated;
    });
  }
}
