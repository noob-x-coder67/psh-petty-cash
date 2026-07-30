import { Injectable } from "@nestjs/common";
import type { OrganizationalUnit } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

export interface UnitScopeFilter {
  all: boolean;
  unitIds: string[];
}

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<OrganizationalUnit | null> {
    return this.prisma.organizationalUnit.findUnique({ where: { id } });
  }

  /** Applies the caller's unit scope as a repository-level filter — Build Plan §3.3:
   * "every list query additionally receives a scopeFilter... applied in the repository
   * so even a controller that forgets a decorator cannot leak another unit's rows." */
  async findAuthorizedUnits(scope: UnitScopeFilter): Promise<OrganizationalUnit[]> {
    if (scope.all) {
      return this.prisma.organizationalUnit.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
      });
    }
    if (scope.unitIds.length === 0) {
      return [];
    }
    return this.prisma.organizationalUnit.findMany({
      where: { id: { in: scope.unitIds }, isActive: true },
      orderBy: { code: "asc" },
    });
  }
}
