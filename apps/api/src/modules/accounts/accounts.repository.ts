import { Injectable } from "@nestjs/common";
import type { OrganizationalUnit, PettyCashAccount, Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

type Client = PrismaService | Prisma.TransactionClient;

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

  async create(unitId: string, client: Client = this.prisma): Promise<PettyCashAccount> {
    return client.pettyCashAccount.create({ data: { unitId } });
  }
}
