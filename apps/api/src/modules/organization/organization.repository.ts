import { Injectable } from "@nestjs/common";
import type { OrganizationalUnit, Prisma, UnitType } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

export interface UnitScopeFilter {
  all: boolean;
  unitIds: string[];
}

type Client = PrismaService | Prisma.TransactionClient;

export interface CreateUnitParams {
  code: string;
  name: string;
  type: UnitType;
  city?: string;
  pettyCashEnabled: boolean;
}

export interface UpdateUnitParams {
  name?: string;
  type?: UnitType;
  city?: string;
  pettyCashEnabled?: boolean;
  isActive?: boolean;
}

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<OrganizationalUnit | null> {
    return this.prisma.organizationalUnit.findUnique({ where: { id } });
  }

  async findByCode(code: string): Promise<OrganizationalUnit | null> {
    return this.prisma.organizationalUnit.findUnique({ where: { code } });
  }

  // Admin listing — deliberately not findAuthorizedUnits (which filters isActive:true
  // for scope-switcher/unit-picker use elsewhere): an admin managing units needs to see
  // an inactive one too, or there'd be no way back to reactivate it.
  async listAllForAdmin(): Promise<OrganizationalUnit[]> {
    return this.prisma.organizationalUnit.findMany({ orderBy: { code: "asc" } });
  }

  async create(params: CreateUnitParams, client: Client = this.prisma): Promise<OrganizationalUnit> {
    return client.organizationalUnit.create({
      data: {
        code: params.code,
        name: params.name,
        type: params.type,
        city: params.city,
        pettyCashEnabled: params.pettyCashEnabled,
      },
    });
  }

  async update(id: string, params: UpdateUnitParams, client: Client = this.prisma): Promise<OrganizationalUnit> {
    return client.organizationalUnit.update({ where: { id }, data: params });
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
