import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface RecordAuditParams {
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  unitId: string | null;
  // FR-AUD-002: "IP/device metadata where available" — best-effort, not every mutation
  // has request-level context readily at hand, so these stay optional.
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  diff?: unknown;
}

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === undefined || value === null
    ? Prisma.JsonNull
    : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
}

/**
 * Writes an audit_logs row using the same Prisma.TransactionClient the caller's
 * mutation runs in — audit rows are written inside the same transaction as the change
 * they describe (rule 16, FR-AUD-002), never as an afterthought once it commits.
 */
@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(tx: Prisma.TransactionClient, params: RecordAuditParams): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId: params.actorId,
        actorRole: params.actorRole,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        unitId: params.unitId,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
        requestId: params.requestId ?? null,
        reason: params.reason ?? null,
        before: toJson(params.before),
        after: toJson(params.after),
        diff: toJson(params.diff),
      },
    });
  }
}
