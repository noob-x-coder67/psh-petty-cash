import { Injectable } from "@nestjs/common";
import type { CashAllocation } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

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

  async create(params: CreateAllocationParams): Promise<CashAllocation> {
    return this.prisma.cashAllocation.create({ data: params });
  }

  async findById(id: string): Promise<CashAllocation | null> {
    return this.prisma.cashAllocation.findUnique({ where: { id } });
  }

  async findByIdempotencyKey(key: string): Promise<CashAllocation | null> {
    return this.prisma.cashAllocation.findUnique({ where: { idempotencyKey: key } });
  }

  async markConfirmed(
    id: string,
    confirmedAmount: string,
    confirmedDate: Date,
    confirmedBy: string,
  ): Promise<CashAllocation> {
    return this.prisma.cashAllocation.update({
      where: { id },
      data: { confirmedAmount, confirmedDate, confirmedBy, confirmedAt: new Date() },
    });
  }
}
