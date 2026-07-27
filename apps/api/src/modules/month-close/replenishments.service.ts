import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  ComplianceMonth,
  ComplianceResponse,
  ConfirmReplenishmentRequest,
  CreateReplenishmentRequest,
  Replenishment,
} from "@psh/contracts";
import { AuditLogRepository } from "../../common/audit/audit-log.repository";
import { LedgerPostingRepository } from "../../common/ledger/ledger-posting.repository";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AccountsRepository } from "../accounts/accounts.repository";
import { currentKarachiPeriod } from "../dashboard/period.util";
import { MonthCloseRepository } from "./month-close.repository";
import { ReplenishmentsRepository, type ReplenishmentWithRelations } from "./replenishments.repository";
import { evaluateThreeMonthCompliance, precedingThreeMonths } from "./replenishments.rules";

// Long enough to comfortably show a year-boundary crossing (FR-CLS-009 / Phase 7's exit
// gate), short enough that a unit with no history at all doesn't render 5 years of
// "MISSING" tiles.
const TIMELINE_MONTHS = 14;

export interface CreateReplenishmentInput extends CreateReplenishmentRequest {
  actor: AuthenticatedUser;
}

@Injectable()
export class ReplenishmentsService {
  constructor(
    private readonly replenishmentsRepository: ReplenishmentsRepository,
    private readonly monthCloseRepository: MonthCloseRepository,
    private readonly accountsRepository: AccountsRepository,
    private readonly ledgerPostingRepository: LedgerPostingRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createReplenishment(input: CreateReplenishmentInput): Promise<Replenishment> {
    // FR-REP-006-style idempotent replay, same pattern as CashAllocation.
    const existing = await this.replenishmentsRepository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return this.toContractShape(existing);
    }

    const account = await this.accountsRepository.findByUnitId(input.unitId);
    if (!account) {
      throw new NotFoundException(`Unit ${input.unitId} has no petty-cash account`);
    }

    const issueDate = new Date(input.issueDate);
    const targetYear = issueDate.getUTCFullYear();
    const targetMonth = issueDate.getUTCMonth() + 1;
    const statusByPeriod = await this.monthCloseRepository.findStatusesForPeriods(
      account.id,
      precedingThreeMonths(targetYear, targetMonth),
    );
    const compliance = evaluateThreeMonthCompliance(targetYear, targetMonth, statusByPeriod);

    // FR-REP-003/004: hold unless compliant, or a Finance Manager/Super Admin records an
    // exception. A Finance Officer who lacks the override permission is rejected even if
    // they supply a reason — the reason alone isn't the authorization.
    let exceptionReason: string | null = null;
    if (!compliance.isCompliant) {
      if (!input.actor.permissionKeys.includes("compliance.override_three_month_hold")) {
        throw new ConflictException(
          "Hold - Three-Month Closing Incomplete: the preceding three monthly closings are not all CLOSED",
        );
      }
      if (!input.exceptionReason?.trim()) {
        throw new BadRequestException("An exception reason is required to override the three-month hold");
      }
      exceptionReason = input.exceptionReason.trim();
    }

    let created: ReplenishmentWithRelations;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const result = await this.replenishmentsRepository.create(
          {
            accountId: account.id,
            amount: new Prisma.Decimal(input.amount),
            issueDate,
            referenceNo: input.referenceNo ?? null,
            paymentMode: input.paymentMode ?? null,
            remarks: input.remarks ?? null,
            isCompliant: compliance.isCompliant,
            exceptionReason,
            exceptionBy: exceptionReason ? input.actor.id : null,
            exceptionAt: exceptionReason ? new Date() : null,
            issuedBy: input.actor.id,
            idempotencyKey: input.idempotencyKey,
          },
          tx,
        );
        await this.auditLogRepository.record(tx, {
          actorId: input.actor.id,
          actorRole: input.actor.roleKeys[0] ?? null,
          action: "REPLENISHMENT_CREATE",
          entityType: "replenishments",
          entityId: result.id,
          unitId: account.unitId,
          reason: exceptionReason,
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

    return this.toContractShape(created);
  }

  async confirmReplenishment(
    id: string,
    input: ConfirmReplenishmentRequest,
    actor: AuthenticatedUser,
  ): Promise<Replenishment> {
    const replenishment = await this.replenishmentsRepository.findById(id);
    if (!replenishment) {
      throw new NotFoundException(`Replenishment ${id} not found`);
    }
    if (replenishment.confirmedAt) {
      throw new ConflictException("Replenishment already confirmed");
    }
    this.assertUnitScope(replenishment.account.unitId, actor);

    const confirmedAmount = new Prisma.Decimal(input.confirmedAmount);
    const confirmedDate = new Date(input.confirmedDate);

    const confirmed = await this.prisma.$transaction(async (tx) => {
      await this.ledgerPostingRepository.postEntryWithTx(tx, {
        accountId: replenishment.accountId,
        entryType: "REPLENISHMENT",
        direction: 1,
        amount: confirmedAmount,
        effectiveDate: confirmedDate,
        sourceTable: "replenishments",
        sourceId: replenishment.id,
        createdBy: actor.id,
      });
      const result = await this.replenishmentsRepository.markConfirmed(id, confirmedAmount, confirmedDate, actor.id, tx);
      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "REPLENISHMENT_CONFIRM",
        entityType: "replenishments",
        entityId: id,
        unitId: replenishment.account.unitId,
        before: replenishment,
        after: result,
      });
      return result;
    });

    return this.toContractShape(confirmed);
  }

  async getCompliance(unitId: string, actor: AuthenticatedUser): Promise<ComplianceResponse> {
    this.assertUnitScope(unitId, actor);
    const [account, unit] = await Promise.all([
      this.accountsRepository.findByUnitId(unitId),
      this.accountsRepository.findUnitById(unitId),
    ]);
    if (!account || !unit) {
      throw new NotFoundException(`Unit ${unitId} has no petty-cash account`);
    }

    const anchor = currentKarachiPeriod().start;
    const currentYear = anchor.getUTCFullYear();
    const currentMonth = anchor.getUTCMonth() + 1;

    const timelinePeriods: Array<{ year: number; month: number }> = [];
    let y = currentYear;
    let m = currentMonth;
    for (let i = 0; i < TIMELINE_MONTHS; i += 1) {
      timelinePeriods.unshift({ year: y, month: m });
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
    }

    const statuses = await this.monthCloseRepository.findStatusesForPeriods(account.id, timelinePeriods);
    const timeline: ComplianceMonth[] = timelinePeriods.map((period) => ({
      year: period.year,
      month: period.month,
      status: statuses.get(`${period.year}-${period.month}`) ?? "MISSING",
    }));

    const nextCompliance = evaluateThreeMonthCompliance(currentYear, currentMonth, statuses);

    return {
      unitId,
      unitCode: unit.code,
      timeline,
      nextReplenishment: {
        targetYear: currentYear,
        targetMonth: currentMonth,
        isCompliant: nextCompliance.isCompliant,
        requiredMonths: nextCompliance.requiredMonths,
      },
    };
  }

  private toContractShape(row: ReplenishmentWithRelations): Replenishment {
    return {
      id: row.id,
      unitId: row.account.unitId,
      amount: row.amount.toFixed(2),
      issueDate: row.issueDate.toISOString().slice(0, 10),
      referenceNo: row.referenceNo,
      paymentMode: row.paymentMode,
      remarks: row.remarks,
      isCompliant: row.isCompliant,
      exceptionReason: row.exceptionReason,
      exceptionByName: row.exceptionActor?.fullName ?? null,
      exceptionAt: row.exceptionAt ? row.exceptionAt.toISOString() : null,
      confirmedAmount: row.confirmedAmount ? row.confirmedAmount.toFixed(2) : null,
      confirmedDate: row.confirmedDate ? row.confirmedDate.toISOString().slice(0, 10) : null,
      confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
    };
  }

  private assertUnitScope(unitId: string, actor: AuthenticatedUser): void {
    if (actor.unitScope.all) {
      return;
    }
    if (!actor.unitScope.unitIds.includes(unitId)) {
      throw new ForbiddenException("Replenishment is outside your authorized scope");
    }
  }
}
