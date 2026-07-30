import { Injectable } from "@nestjs/common";
import type { CashAllocation, Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

type Client = PrismaService | Prisma.TransactionClient;

export interface CreateAllocationParams {
  accountId: string;
  amount: string;
  issueDate: Date;
  referenceNo?: string;
  paymentMode?: string;
  remarks?: string;
  issuedBy: string;
  idempotencyKey: string;
}

@Injectable()
export class AllocationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateAllocationParams, client: Client = this.prisma): Promise<CashAllocation> {
    return client.cashAllocation.create({ data: params });
  }

  async findById(id: string): Promise<CashAllocation | null> {
    return this.prisma.cashAllocation.findUnique({ where: { id } });
  }

  async findByIdempotencyKey(key: string): Promise<CashAllocation | null> {
    return this.prisma.cashAllocation.findUnique({ where: { idempotencyKey: key } });
  }

  async findPendingByAccountId(accountId: string): Promise<CashAllocation[]> {
    return this.prisma.cashAllocation.findMany({
      where: { accountId, confirmedAt: null },
      orderBy: { issueDate: "desc" },
    });
  }

  async markConfirmed(
    id: string,
    confirmedAmount: string,
    confirmedDate: Date,
    confirmedBy: string,
    client: Client = this.prisma,
  ): Promise<CashAllocation> {
    return client.cashAllocation.update({
      where: { id },
      data: { confirmedAmount, confirmedDate, confirmedBy, confirmedAt: new Date() },
    });
  }
}
