import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { CashAllocation } from "@prisma/client";
import type { Allocation } from "@psh/contracts";
import { AuditLogRepository } from "../../common/audit/audit-log.repository";
import { LedgerPostingRepository } from "../../common/ledger/ledger-posting.repository";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AccountsRepository } from "../accounts/accounts.repository";
import { AllocationsRepository } from "./allocations.repository";

export interface CreateAllocationInput {
  unitId: string;
  amount: string;
  issueDate: string;
  referenceNo?: string;
  paymentMode?: string;
  remarks?: string;
  idempotencyKey: string;
  issuer: AuthenticatedUser;
}

export interface ConfirmAllocationInput {
  allocationId: string;
  confirmedDate: string;
  confirmedBy: AuthenticatedUser;
}

@Injectable()
export class AllocationsService {
  constructor(
    private readonly allocationsRepository: AllocationsRepository,
    private readonly accountsRepository: AccountsRepository,
    private readonly ledgerPostingRepository: LedgerPostingRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createAllocation(input: CreateAllocationInput): Promise<Allocation> {
    // FR-REP-006-style idempotent replay: the same key returns the original record
    // rather than erroring, so a retried request is never double-recorded.
    const existing = await this.allocationsRepository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      const existingAccount = await this.accountsRepository.findById(existing.accountId);
      if (!existingAccount) {
        throw new NotFoundException(`Account ${existing.accountId} not found`);
      }
      return this.toContractShape(existing, existingAccount.unitId);
    }

    const account = await this.accountsRepository.findByUnitId(input.unitId);
    if (!account) {
      throw new NotFoundException(`Unit ${input.unitId} has no petty-cash account`);
    }

    const allocation = await this.prisma.$transaction(async (tx) => {
      const created = await this.allocationsRepository.create(
        {
          accountId: account.id,
          amount: input.amount,
          issueDate: new Date(input.issueDate),
          referenceNo: input.referenceNo,
          paymentMode: input.paymentMode,
          remarks: input.remarks,
          issuedBy: input.issuer.id,
          idempotencyKey: input.idempotencyKey,
        },
        tx,
      );
      await this.auditLogRepository.record(tx, {
        actorId: input.issuer.id,
        actorRole: input.issuer.roleKeys[0] ?? null,
        action: "ALLOCATION_CREATE",
        entityType: "cash_allocations",
        entityId: created.id,
        unitId: account.unitId,
        after: created,
      });
      return created;
    });
    return this.toContractShape(allocation, account.unitId);
  }

  async listPending(unitId: string, actor: AuthenticatedUser): Promise<Allocation[]> {
    this.assertUnitScope(unitId, actor);
    const account = await this.accountsRepository.findByUnitId(unitId);
    if (!account) {
      throw new NotFoundException(`Unit ${unitId} has no petty-cash account`);
    }
    const pending = await this.allocationsRepository.findPendingByAccountId(account.id);
    return pending.map((row) => this.toContractShape(row, unitId));
  }

  async confirmAllocation(input: ConfirmAllocationInput): Promise<Allocation> {
    const allocation = await this.allocationsRepository.findById(input.allocationId);
    if (!allocation) {
      throw new NotFoundException(`Allocation ${input.allocationId} not found`);
    }
    if (allocation.confirmedAt) {
      throw new ConflictException("Allocation already confirmed");
    }

    const account = await this.accountsRepository.findById(allocation.accountId);
    if (!account) {
      throw new NotFoundException(`Account ${allocation.accountId} not found`);
    }
    // Unit-scope check lives here rather than in a guard decorator — the route param is
    // the allocation id, not a unit id, so there is nothing for UnitScopeGuard to check
    // directly (Build Plan §3.3's repository-level scopeFilter pattern, applied here to
    // a single-record lookup instead of a list).
    if (!input.confirmedBy.unitScope.all && !input.confirmedBy.unitScope.unitIds.includes(account.unitId)) {
      throw new ForbiddenException("Allocation is outside your authorized scope");
    }

    // ADR-0009: confirmation is a locked, exact-match attestation against the original
    // allocated amount — cash is handed over hand-to-hand, so the amount is never
    // client-supplied and never varies. No variance check, no remarks.
    // Ledger post, allocation confirmation, and the audit row all commit or roll back
    // together — a crash between "ledger posted" and "allocation marked confirmed"
    // must never happen (this used to be two separate transactions; fixed here).
    const confirmed = await this.prisma.$transaction(async (tx) => {
      await this.ledgerPostingRepository.postEntryWithTx(tx, {
        accountId: allocation.accountId,
        entryType: "ALLOCATION",
        direction: 1,
        amount: allocation.amount,
        effectiveDate: new Date(input.confirmedDate),
        sourceTable: "cash_allocations",
        sourceId: allocation.id,
        createdBy: input.confirmedBy.id,
      });

      const result = await this.allocationsRepository.markConfirmed(
        allocation.id,
        allocation.amount.toFixed(2),
        new Date(input.confirmedDate),
        input.confirmedBy.id,
        undefined,
        tx,
      );

      await this.auditLogRepository.record(tx, {
        actorId: input.confirmedBy.id,
        actorRole: input.confirmedBy.roleKeys[0] ?? null,
        action: "ALLOCATION_CONFIRM",
        entityType: "cash_allocations",
        entityId: result.id,
        unitId: account.unitId,
        before: allocation,
        after: result,
      });

      return result;
    });
    return this.toContractShape(confirmed, account.unitId);
  }

  // Mirrors replenishments.service.ts's toContractShape — same Decimal->string /
  // Date->ISO-date-string conversions, so the wire shape is consistent across both
  // create-then-confirm cash-flow features.
  private toContractShape(row: CashAllocation, unitId: string): Allocation {
    return {
      id: row.id,
      unitId,
      amount: row.amount.toFixed(2),
      issueDate: row.issueDate.toISOString().slice(0, 10),
      referenceNo: row.referenceNo,
      paymentMode: row.paymentMode,
      remarks: row.remarks,
      confirmedAmount: row.confirmedAmount ? row.confirmedAmount.toFixed(2) : null,
      confirmedDate: row.confirmedDate ? row.confirmedDate.toISOString().slice(0, 10) : null,
      confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
      confirmedVarianceRemarks: row.confirmedVarianceRemarks,
    };
  }

  // Defense in depth alongside the controller's @RequiresUnitScope("param.unitId") —
  // same reasoning as every other independently-checked layer in this codebase (e.g.
  // BR-016's PSH-ISB guard existing at both the service and DB-constraint layers).
  private assertUnitScope(unitId: string, actor: AuthenticatedUser): void {
    if (actor.unitScope.all) {
      return;
    }
    if (!actor.unitScope.unitIds.includes(unitId)) {
      throw new ForbiddenException("Unit is outside your authorized scope");
    }
  }
}
