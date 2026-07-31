import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { ComplianceMonth, ComplianceResponse, ConfirmReplenishmentRequest, Replenishment } from "@psh/contracts";
import { AuditLogRepository } from "../../common/audit/audit-log.repository";
import { LedgerPostingRepository } from "../../common/ledger/ledger-posting.repository";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AccountsRepository } from "../accounts/accounts.repository";
import { currentKarachiPeriod } from "../dashboard/period.util";
import { MonthCloseRepository } from "./month-close.repository";
import { ReplenishmentsRepository, type ReplenishmentWithRelations } from "./replenishments.repository";
import { evaluateThreeMonthCompliance } from "./replenishments.rules";

// Long enough to comfortably show a year-boundary crossing (FR-CLS-009 / Phase 7's exit
// gate), short enough that a unit with no history at all doesn't render 5 years of
// "MISSING" tiles.
const TIMELINE_MONTHS = 14;

// ADR-0010: direct-create (createReplenishment) is gone — a Replenishment row is only
// ever produced by ReplenishmentRequestsService's approve()/submitOverride(), via
// ReplenishmentsRepository.create() (reused directly, not duplicated). This service now
// only covers what didn't change: hand-to-hand confirm receipt (ADR-0009) and the
// compliance timeline/forecast.
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

  async listPending(unitId: string, actor: AuthenticatedUser): Promise<Replenishment[]> {
    this.assertUnitScope(unitId, actor);
    const account = await this.accountsRepository.findByUnitId(unitId);
    if (!account) {
      throw new NotFoundException(`Unit ${unitId} has no petty-cash account`);
    }
    const pending = await this.replenishmentsRepository.findPending(account.id);
    return pending.map((row) => this.toContractShape(row));
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

    const confirmedDate = new Date(input.confirmedDate);

    // ADR-0009: confirmation is a locked, exact-match attestation against the original
    // replenished amount — cash is handed over hand-to-hand, so the amount is never
    // client-supplied and never varies. No variance check, no remarks.
    const confirmed = await this.prisma.$transaction(async (tx) => {
      await this.ledgerPostingRepository.postEntryWithTx(tx, {
        accountId: replenishment.accountId,
        entryType: "REPLENISHMENT",
        direction: 1,
        amount: replenishment.amount,
        effectiveDate: confirmedDate,
        sourceTable: "replenishments",
        sourceId: replenishment.id,
        createdBy: actor.id,
      });
      const result = await this.replenishmentsRepository.markConfirmed(
        id,
        replenishment.amount,
        confirmedDate,
        actor.id,
        undefined,
        tx,
      );
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
      confirmedVarianceRemarks: row.confirmedVarianceRemarks,
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
