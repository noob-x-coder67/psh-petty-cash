import { Injectable } from "@nestjs/common";
import type { OrganizationalUnit, PettyCashAccount } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUnitById(unitId: string): Promise<OrganizationalUnit | null> {
    return this.prisma.organizationalUnit.findUnique({ where: { id: unitId } });
  }

  async findByUnitId(unitId: string): Promise<PettyCashAccount | null> {
    return this.prisma.pettyCashAccount.findUnique({ where: { unitId } });
  }

  async findById(id: string): Promise<PettyCashAccount | null> {
    return this.prisma.pettyCashAccount.findUnique({ where: { id } });
  }

  async create(unitId: string): Promise<PettyCashAccount> {
    return this.prisma.pettyCashAccount.create({ data: { unitId } });
  }
}
