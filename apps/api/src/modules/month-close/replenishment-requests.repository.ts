import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

type Client = PrismaService | Prisma.TransactionClient;

const REPLENISHMENT_REQUEST_INCLUDE = {
  account: { include: { unit: true } },
  requester: true,
  decider: true,
  exceptionActor: true,
  // Non-owning side (the FK lives on Replenishment.requestId) — still includable,
  // Prisma resolves it via the relation, not a local column.
  replenishment: true,
} satisfies Prisma.ReplenishmentRequestInclude;

export type ReplenishmentRequestWithRelations = Prisma.ReplenishmentRequestGetPayload<{
  include: typeof REPLENISHMENT_REQUEST_INCLUDE;
}>;

export interface CreateReplenishmentRequestParams {
  accountId: string;
  amount: Prisma.Decimal;
  reason: string;
  status: "PENDING" | "APPROVED";
  requestedBy: string;
  isCompliant: boolean;
  exceptionReason: string | null;
  exceptionBy: string | null;
  exceptionAt: Date | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  issueDate: Date | null;
  referenceNo: string | null;
  paymentMode: string | null;
  remarks: string | null;
  idempotencyKey: string;
}

export interface MarkDecisionParams {
  status: "APPROVED" | "REJECTED";
  decidedBy: string;
  decidedAt: Date;
  rejectionReason?: string | null;
  issueDate?: Date | null;
  referenceNo?: string | null;
  paymentMode?: string | null;
  remarks?: string | null;
}

@Injectable()
export class ReplenishmentRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdempotencyKey(idempotencyKey: string): Promise<ReplenishmentRequestWithRelations | null> {
    return this.prisma.replenishmentRequest.findUnique({
      where: { idempotencyKey },
      include: REPLENISHMENT_REQUEST_INCLUDE,
    });
  }

  async create(
    params: CreateReplenishmentRequestParams,
    client: Client = this.prisma,
  ): Promise<ReplenishmentRequestWithRelations> {
    return client.replenishmentRequest.create({ data: params, include: REPLENISHMENT_REQUEST_INCLUDE });
  }

  async findById(id: string): Promise<ReplenishmentRequestWithRelations | null> {
    return this.prisma.replenishmentRequest.findUnique({ where: { id }, include: REPLENISHMENT_REQUEST_INCLUDE });
  }

  // Finance approval queue — cross-unit by design (see ReplenishmentRequestsService.listPending).
  async findPendingAll(): Promise<ReplenishmentRequestWithRelations[]> {
    return this.prisma.replenishmentRequest.findMany({
      where: { status: "PENDING" },
      include: REPLENISHMENT_REQUEST_INCLUDE,
      orderBy: { requestedAt: "asc" },
    });
  }

  // A unit's own request history — every status, so a rejection is visible, not just
  // pending ones.
  async findByAccount(accountId: string): Promise<ReplenishmentRequestWithRelations[]> {
    return this.prisma.replenishmentRequest.findMany({
      where: { accountId },
      include: REPLENISHMENT_REQUEST_INCLUDE,
      orderBy: { requestedAt: "desc" },
    });
  }

  async markDecision(
    id: string,
    data: MarkDecisionParams,
    client: Client = this.prisma,
  ): Promise<ReplenishmentRequestWithRelations> {
    return client.replenishmentRequest.update({
      where: { id },
      data,
      include: REPLENISHMENT_REQUEST_INCLUDE,
    });
  }
}
