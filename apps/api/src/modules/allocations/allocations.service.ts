import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type CashAllocation } from "@prisma/client";
import { LedgerPostingRepository } from "../../common/ledger/ledger-posting.repository";
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
  issuedBy: string;
}

export interface ConfirmAllocationInput {
  allocationId: string;
  confirmedAmount: string;
  confirmedDate: string;
  confirmedBy: AuthenticatedUser;
}

@Injectable()
export class AllocationsService {
  constructor(
    private readonly allocationsRepository: AllocationsRepository,
    private readonly accountsRepository: AccountsRepository,
    private readonly ledgerPostingRepository: LedgerPostingRepository,
  ) {}

  async createAllocation(input: CreateAllocationInput): Promise<CashAllocation> {
    // FR-REP-006-style idempotent replay: the same key returns the original record
    // rather than erroring, so a retried request is never double-recorded.
    const existing = await this.allocationsRepository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return existing;
    }

    const account = await this.accountsRepository.findByUnitId(input.unitId);
    if (!account) {
      throw new NotFoundException(`Unit ${input.unitId} has no petty-cash account`);
    }

    return this.allocationsRepository.create({
      accountId: account.id,
      amount: input.amount,
      issueDate: new Date(input.issueDate),
      referenceNo: input.referenceNo,
      paymentMode: input.paymentMode,
      remarks: input.remarks,
      issuedBy: input.issuedBy,
      idempotencyKey: input.idempotencyKey,
    });
  }

  async confirmAllocation(input: ConfirmAllocationInput): Promise<CashAllocation> {
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

    // Ledger entry is posted only on confirmation (FR-CASH-003) — never on create.
    await this.ledgerPostingRepository.postEntry({
      accountId: allocation.accountId,
      entryType: "ALLOCATION",
      direction: 1,
      amount: new Prisma.Decimal(input.confirmedAmount),
      effectiveDate: new Date(input.confirmedDate),
      sourceTable: "cash_allocations",
      sourceId: allocation.id,
      createdBy: input.confirmedBy.id,
    });

    return this.allocationsRepository.markConfirmed(
      allocation.id,
      input.confirmedAmount,
      new Date(input.confirmedDate),
      input.confirmedBy.id,
    );
  }
}
