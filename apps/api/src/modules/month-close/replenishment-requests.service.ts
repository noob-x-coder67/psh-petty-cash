import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  ApproveReplenishmentRequest,
  RejectReplenishmentRequest,
  ReplenishmentRequest,
  SubmitReplenishmentOverride,
  SubmitReplenishmentRequest,
} from "@psh/contracts";
import { AuditLogRepository } from "../../common/audit/audit-log.repository";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AccountsRepository } from "../accounts/accounts.repository";
import { currentKarachiPeriod } from "../dashboard/period.util";
import { MonthCloseRepository } from "./month-close.repository";
import {
  ReplenishmentRequestsRepository,
  type ReplenishmentRequestWithRelations,
} from "./replenishment-requests.repository";
import { ReplenishmentsRepository, type ReplenishmentWithRelations } from "./replenishments.repository";
import { evaluateThreeMonthCompliance, precedingThreeMonths } from "./replenishments.rules";

export interface SubmitReplenishmentRequestInput extends SubmitReplenishmentRequest {
  actor: AuthenticatedUser;
}
export interface SubmitReplenishmentOverrideInput extends SubmitReplenishmentOverride {
  actor: AuthenticatedUser;
}

// ADR-0010: unit submits (amount + reason only, BR-013 enforced here at submission —
// see submitRequest); Finance approves (creating the real Replenishment, via
// ReplenishmentsRepository.create, reused not duplicated) or rejects; the
// Finance-initiated override path creates+approves atomically for a genuinely held
// unit, preserving BR-013's audited-exception clause without giving the unit itself any
// bypass. Confirming receipt is unchanged (ReplenishmentsService.confirmReplenishment,
// ADR-0009).
@Injectable()
export class ReplenishmentRequestsService {
  constructor(
    private readonly requestsRepository: ReplenishmentRequestsRepository,
    private readonly replenishmentsRepository: ReplenishmentsRepository,
    private readonly monthCloseRepository: MonthCloseRepository,
    private readonly accountsRepository: AccountsRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly prisma: PrismaService,
  ) {}

  async submitRequest(input: SubmitReplenishmentRequestInput): Promise<ReplenishmentRequest> {
    const existing = await this.requestsRepository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return this.toContractShape(existing);
    }

    const account = await this.accountsRepository.findByUnitId(input.unitId);
    if (!account) {
      throw new NotFoundException(`Unit ${input.unitId} has no petty-cash account`);
    }

    const compliance = await this.evaluateCurrentCompliance(account.id);
    if (!compliance.isCompliant) {
      // No row is persisted at all — the unit has no bypass. Only a Finance
      // Manager/Super Admin invoking the override route (below) can push a
      // replenishment through while held.
      throw new ConflictException(
        "Hold - Three-Month Closing Incomplete: the preceding three monthly closings are not all CLOSED. " +
          "A Finance Manager or Super Admin can use the audited override if this is a genuine exception.",
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const result = await this.requestsRepository.create(
        {
          accountId: account.id,
          amount: new Prisma.Decimal(input.amount),
          reason: input.reason.trim(),
          status: "PENDING",
          requestedBy: input.actor.id,
          isCompliant: true,
          exceptionReason: null,
          exceptionBy: null,
          exceptionAt: null,
          decidedBy: null,
          decidedAt: null,
          issueDate: null,
          referenceNo: null,
          paymentMode: null,
          remarks: null,
          idempotencyKey: input.idempotencyKey,
        },
        tx,
      );
      await this.auditLogRepository.record(tx, {
        actorId: input.actor.id,
        actorRole: input.actor.roleKeys[0] ?? null,
        action: "REPLENISHMENT_REQUEST_SUBMIT",
        entityType: "replenishment_requests",
        entityId: result.id,
        unitId: account.unitId,
        after: result,
      });
      return result;
    });

    return this.toContractShape(created);
  }

  async submitOverride(input: SubmitReplenishmentOverrideInput): Promise<ReplenishmentRequest> {
    const existing = await this.requestsRepository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return this.toContractShape(existing);
    }

    const account = await this.accountsRepository.findByUnitId(input.unitId);
    if (!account) {
      throw new NotFoundException(`Unit ${input.unitId} has no petty-cash account`);
    }

    const compliance = await this.evaluateCurrentCompliance(account.id);
    if (compliance.isCompliant) {
      throw new BadRequestException(
        "This unit is currently compliant — use the normal request/approve flow instead of the override",
      );
    }
    const exceptionReason = input.exceptionReason.trim();
    if (!exceptionReason) {
      throw new BadRequestException("An exception reason is required to override the three-month hold");
    }

    const now = new Date();
    const issueDate = new Date(input.issueDate);
    const amount = new Prisma.Decimal(input.amount);

    let request: ReplenishmentRequestWithRelations;
    let replenishment: ReplenishmentWithRelations;
    try {
      ({ request, replenishment } = await this.prisma.$transaction(async (tx) => {
        const requestRow = await this.requestsRepository.create(
          {
            accountId: account.id,
            amount,
            reason: input.reason.trim(),
            status: "APPROVED",
            requestedBy: input.actor.id,
            isCompliant: false,
            exceptionReason,
            exceptionBy: input.actor.id,
            exceptionAt: now,
            decidedBy: input.actor.id,
            decidedAt: now,
            issueDate,
            referenceNo: input.referenceNo ?? null,
            paymentMode: input.paymentMode ?? null,
            remarks: input.remarks ?? null,
            idempotencyKey: input.idempotencyKey,
          },
          tx,
        );
        const replenishmentRow = await this.replenishmentsRepository.create(
          {
            accountId: account.id,
            amount,
            issueDate,
            referenceNo: input.referenceNo ?? null,
            paymentMode: input.paymentMode ?? null,
            remarks: input.remarks ?? null,
            isCompliant: false,
            exceptionReason,
            exceptionBy: input.actor.id,
            exceptionAt: now,
            issuedBy: input.actor.id,
            idempotencyKey: requestRow.idempotencyKey,
            requestId: requestRow.id,
          },
          tx,
        );
        await this.auditLogRepository.record(tx, {
          actorId: input.actor.id,
          actorRole: input.actor.roleKeys[0] ?? null,
          action: "REPLENISHMENT_REQUEST_OVERRIDE",
          entityType: "replenishment_requests",
          entityId: requestRow.id,
          unitId: account.unitId,
          reason: exceptionReason,
          after: { request: requestRow, replenishment: replenishmentRow },
        });
        return { request: requestRow, replenishment: replenishmentRow };
      }));
    } catch (error) {
      // uq_replenishment_account_reference (FR-REP-006) — a friendlier 409 than a raw
      // constraint-violation 500.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("This reference number has already been used for a replenishment on this account");
      }
      throw error;
    }

    // `request` was fetched (via create()'s own include) before `replenishment` existed,
    // so its `.replenishment` field is still null — merge in the row we just created
    // rather than re-querying.
    return this.toContractShape({ ...request, replenishment });
  }

  async listPending(actor: AuthenticatedUser): Promise<ReplenishmentRequest[]> {
    this.assertCrossUnitScope(actor);
    const rows = await this.requestsRepository.findPendingAll();
    return rows.map((row) => this.toContractShape(row));
  }

  async listForUnit(unitId: string, actor: AuthenticatedUser): Promise<ReplenishmentRequest[]> {
    this.assertUnitScope(unitId, actor);
    const account = await this.accountsRepository.findByUnitId(unitId);
    if (!account) {
      throw new NotFoundException(`Unit ${unitId} has no petty-cash account`);
    }
    const rows = await this.requestsRepository.findByAccount(account.id);
    return rows.map((row) => this.toContractShape(row));
  }

  async approve(id: string, input: ApproveReplenishmentRequest, actor: AuthenticatedUser): Promise<ReplenishmentRequest> {
    this.assertCrossUnitScope(actor);
    const request = await this.requestsRepository.findById(id);
    if (!request) {
      throw new NotFoundException(`Replenishment request ${id} not found`);
    }
    if (request.status !== "PENDING") {
      throw new ConflictException(`Replenishment request is already ${request.status.toLowerCase()}`);
    }

    const issueDate = new Date(input.issueDate);
    const decidedAt = new Date();

    let updated: ReplenishmentRequestWithRelations;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        await this.replenishmentsRepository.create(
          {
            accountId: request.accountId,
            amount: request.amount,
            issueDate,
            referenceNo: input.referenceNo ?? null,
            paymentMode: input.paymentMode ?? null,
            remarks: input.remarks ?? null,
            isCompliant: true,
            exceptionReason: null,
            exceptionBy: null,
            exceptionAt: null,
            issuedBy: actor.id,
            idempotencyKey: request.idempotencyKey,
            requestId: request.id,
          },
          tx,
        );
        // Re-selected inside the same transaction, after the replenishment above was
        // created — its `replenishment: true` include now resolves to that row.
        const result = await this.requestsRepository.markDecision(
          id,
          {
            status: "APPROVED",
            decidedBy: actor.id,
            decidedAt,
            issueDate,
            referenceNo: input.referenceNo ?? null,
            paymentMode: input.paymentMode ?? null,
            remarks: input.remarks ?? null,
          },
          tx,
        );
        await this.auditLogRepository.record(tx, {
          actorId: actor.id,
          actorRole: actor.roleKeys[0] ?? null,
          action: "REPLENISHMENT_REQUEST_APPROVE",
          entityType: "replenishment_requests",
          entityId: id,
          unitId: request.account.unitId,
          before: request,
          after: result,
        });
        return result;
      });
    } catch (error) {
      // uq_replenishment_account_reference (FR-REP-006) — a friendlier 409 than a raw
      // constraint-violation 500.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("This reference number has already been used for a replenishment on this account");
      }
      throw error;
    }

    return this.toContractShape(updated);
  }

  async reject(id: string, input: RejectReplenishmentRequest, actor: AuthenticatedUser): Promise<ReplenishmentRequest> {
    this.assertCrossUnitScope(actor);
    const request = await this.requestsRepository.findById(id);
    if (!request) {
      throw new NotFoundException(`Replenishment request ${id} not found`);
    }
    if (request.status !== "PENDING") {
      throw new ConflictException(`Replenishment request is already ${request.status.toLowerCase()}`);
    }
    const rejectionReason = input.rejectionReason.trim();
    if (!rejectionReason) {
      throw new BadRequestException("A rejection reason is required");
    }

    const decidedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await this.requestsRepository.markDecision(
        id,
        { status: "REJECTED", decidedBy: actor.id, decidedAt, rejectionReason },
        tx,
      );
      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "REPLENISHMENT_REQUEST_REJECT",
        entityType: "replenishment_requests",
        entityId: id,
        unitId: request.account.unitId,
        before: request,
        after: result,
      });
      return result;
    });

    return this.toContractShape(updated);
  }

  // BR-013 target period is "now" — a request has no issueDate of its own yet (that's
  // only ever supplied by Finance, at approve/override time), so the compliance check
  // is against the unit's current operating month, same anchor GET /compliance/:unitId
  // already uses (currentKarachiPeriod).
  private async evaluateCurrentCompliance(accountId: string): Promise<{ isCompliant: boolean }> {
    const anchor = currentKarachiPeriod().start;
    const year = anchor.getUTCFullYear();
    const month = anchor.getUTCMonth() + 1;
    const statusByPeriod = await this.monthCloseRepository.findStatusesForPeriods(
      accountId,
      precedingThreeMonths(year, month),
    );
    return evaluateThreeMonthCompliance(year, month, statusByPeriod);
  }

  private toContractShape(row: ReplenishmentRequestWithRelations): ReplenishmentRequest {
    return {
      id: row.id,
      unitId: row.account.unitId,
      unitCode: row.account.unit.code,
      amount: row.amount.toFixed(2),
      reason: row.reason,
      status: row.status,
      requestedByName: row.requester.fullName,
      requestedAt: row.requestedAt.toISOString(),
      isCompliant: row.isCompliant,
      exceptionReason: row.exceptionReason,
      decidedByName: row.decider?.fullName ?? null,
      decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
      rejectionReason: row.rejectionReason,
      replenishmentId: row.replenishment?.id ?? null,
    };
  }

  private assertUnitScope(unitId: string, actor: AuthenticatedUser): void {
    if (actor.unitScope.all) {
      return;
    }
    if (!actor.unitScope.unitIds.includes(unitId)) {
      throw new ForbiddenException("Replenishment request is outside your authorized scope");
    }
  }

  // The Finance approval queue/approve/reject are cross-unit by design (mirrors
  // DashboardService.getFinanceDashboard's exact backstop) — replenishment.approve is
  // only granted to roles that also hold unitScope.all, this is a second, service-level
  // check, not the only enforcement.
  private assertCrossUnitScope(actor: AuthenticatedUser): void {
    if (!actor.unitScope.all) {
      throw new ForbiddenException("Replenishment approval queue requires cross-unit access");
    }
  }
}
