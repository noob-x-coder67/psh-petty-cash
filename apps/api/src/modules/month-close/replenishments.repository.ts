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
  // ADR-0010: the ReplenishmentRequest (approved or override-created) that produced
  // this row. Optional/nullable only for typing convenience — every caller today
  // (ReplenishmentRequestsService) always supplies it; there is no direct-create path
  // left that would leave it null going forward.
  requestId?: string | null;
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

  async findPending(accountId: string): Promise<ReplenishmentWithRelations[]> {
    return this.prisma.replenishment.findMany({
      where: { accountId, confirmedAt: null },
      include: REPLENISHMENT_INCLUDE,
      orderBy: { issueDate: "desc" },
    });
  }

  async markConfirmed(
    id: string,
    confirmedAmount: Prisma.Decimal,
    confirmedDate: Date,
    confirmedBy: string,
    varianceRemarks: string | undefined,
    client: Client = this.prisma,
  ): Promise<ReplenishmentWithRelations> {
    return client.replenishment.update({
      where: { id },
      data: {
        confirmedAmount,
        confirmedDate,
        confirmedBy,
        confirmedAt: new Date(),
        confirmedVarianceRemarks: varianceRemarks ?? null,
      },
      include: REPLENISHMENT_INCLUDE,
    });
  }
}
