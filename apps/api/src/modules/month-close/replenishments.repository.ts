import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

type Client = PrismaService | Prisma.TransactionClient;

const REPLENISHMENT_INCLUDE = {
  account: { include: { unit: true } },
  exceptionActor: true,
} satisfies Prisma.ReplenishmentInclude;

export type ReplenishmentWithRelations = Prisma.ReplenishmentGetPayload<{ include: typeof REPLENISHMENT_INCLUDE }>;

export interface CreateReplenishmentParams {
  accountId: string;
  amount: Prisma.Decimal;
  issueDate: Date;
  referenceNo: string | null;
  paymentMode: string | null;
  remarks: string | null;
  isCompliant: boolean;
  exceptionReason: string | null;
  exceptionBy: string | null;
  exceptionAt: Date | null;
  issuedBy: string;
  idempotencyKey: string;
}

@Injectable()
export class ReplenishmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdempotencyKey(idempotencyKey: string): Promise<ReplenishmentWithRelations | null> {
    return this.prisma.replenishment.findUnique({ where: { idempotencyKey }, include: REPLENISHMENT_INCLUDE });
  }

  async create(params: CreateReplenishmentParams, client: Client = this.prisma): Promise<ReplenishmentWithRelations> {
    return client.replenishment.create({ data: params, include: REPLENISHMENT_INCLUDE });
  }

  async findById(id: string): Promise<ReplenishmentWithRelations | null> {
    return this.prisma.replenishment.findUnique({ where: { id }, include: REPLENISHMENT_INCLUDE });
  }

  async markConfirmed(
    id: string,
    confirmedAmount: Prisma.Decimal,
    confirmedDate: Date,
    confirmedBy: string,
    client: Client = this.prisma,
  ): Promise<ReplenishmentWithRelations> {
    return client.replenishment.update({
      where: { id },
      data: { confirmedAmount, confirmedDate, confirmedBy, confirmedAt: new Date() },
      include: REPLENISHMENT_INCLUDE,
    });
  }
}
