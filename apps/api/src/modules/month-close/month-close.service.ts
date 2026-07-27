import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { MonthlyClosing, RecordCashCountRequest } from "@psh/contracts";
import { AuditLogRepository } from "../../common/audit/audit-log.repository";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AccountsRepository } from "../accounts/accounts.repository";
import { MonthCloseRepository, type MonthlyClosingWithRelations } from "./month-close.repository";
import { computeVariance, monthBoundaries, remarksRequired } from "./month-close.rules";

@Injectable()
export class MonthCloseService {
  constructor(
    private readonly monthCloseRepository: MonthCloseRepository,
    private readonly accountsRepository: AccountsRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly prisma: PrismaService,
  ) {}

  async recordCashCount(input: RecordCashCountRequest & { actor: AuthenticatedUser }): Promise<MonthlyClosing> {
    const account = await this.accountsRepository.findByUnitId(input.unitId);
    if (!account) {
      throw new NotFoundException(`Unit ${input.unitId} has no petty-cash account`);
    }

    const existing = await this.monthCloseRepository.findClosing(account.id, input.periodYear, input.periodMonth);
    if (existing?.status === "CLOSED") {
      throw new ConflictException("This month is closed — reopen it before recording a new cash count");
    }

    const period = monthBoundaries(input.periodYear, input.periodMonth);
    const physicalCashCount = new Prisma.Decimal(input.physicalCashCount);
    const expectedBalance = await this.monthCloseRepository.computeExpectedBalance(account.id, period.end);
    const variance = computeVariance(physicalCashCount, expectedBalance);

    if (remarksRequired(variance) && !input.remarks?.trim()) {
      throw new BadRequestException("Remarks are required when the physical count does not match the expected balance");
    }

    const [updated] = await this.prisma.$transaction(async (tx) => {
      const result = await this.monthCloseRepository.upsertCashCount({
        accountId: account.id,
        periodYear: input.periodYear,
        periodMonth: input.periodMonth,
        physicalCashCount,
        expectedBalance,
        variance,
        remarks: input.remarks?.trim() ?? null,
        countedBy: input.actor.id,
      });
      await this.auditLogRepository.record(tx, {
        actorId: input.actor.id,
        actorRole: input.actor.roleKeys[0] ?? null,
        action: "MONTH_CLOSE_CASH_COUNT",
        entityType: "monthly_closings",
        entityId: result.id,
        unitId: account.unitId,
        before: existing,
        after: result,
      });
      return [result];
    });

    return this.toContractShape(updated, await this.computeSummaryShape(account.id, period));
  }

  async getClosing(unitId: string, periodYear: number, periodMonth: number, actor: AuthenticatedUser): Promise<MonthlyClosing> {
    this.assertUnitScope(unitId, actor);
    const [account, unit] = await Promise.all([
      this.accountsRepository.findByUnitId(unitId),
      this.accountsRepository.findUnitById(unitId),
    ]);
    if (!account || !unit) {
      throw new NotFoundException(`Unit ${unitId} has no petty-cash account`);
    }

    const period = monthBoundaries(periodYear, periodMonth);
    const existing = await this.monthCloseRepository.findClosing(account.id, periodYear, periodMonth);

    // A CLOSED month's expected balance/variance are the historically recorded figures
    // (FR-CLS "closed data remains reportable") — only an OPEN or not-yet-created month
    // gets a live recompute, since the physical count hasn't been locked in yet.
    const expectedBalance =
      existing?.status === "CLOSED" && existing.expectedBalance
        ? existing.expectedBalance
        : await this.monthCloseRepository.computeExpectedBalance(account.id, period.end);
    const variance =
      existing?.status === "CLOSED" && existing.variance
        ? existing.variance
        : existing?.physicalCashCount
          ? computeVariance(existing.physicalCashCount, expectedBalance)
          : null;

    const summary = await this.computeSummaryShape(account.id, period);

    if (!existing) {
      return {
        id: "",
        unitId,
        unitCode: unit.code,
        periodYear,
        periodMonth,
        physicalCashCount: null,
        countedByName: null,
        countedAt: null,
        expectedBalance: expectedBalance.toFixed(2),
        variance: null,
        remarks: null,
        status: "OPEN",
        closedByName: null,
        closedAt: null,
        reopenedByName: null,
        reopenedAt: null,
        reopenReason: null,
        summary,
      };
    }

    return this.toContractShape({ ...existing, expectedBalance, variance }, summary);
  }

  async closeMonth(id: string, actor: AuthenticatedUser): Promise<MonthlyClosing> {
    const existing = await this.monthCloseRepository.findClosingById(id);
    if (!existing) {
      throw new NotFoundException(`Monthly closing ${id} not found`);
    }
    this.assertUnitScope(existing.account.unitId, actor);
    if (existing.status === "CLOSED") {
      throw new ConflictException("Month is already closed");
    }
    if (!existing.physicalCashCount) {
      throw new ConflictException("A physical cash count must be recorded before closing the month");
    }
    if (existing.variance && !existing.variance.isZero() && !existing.remarks?.trim()) {
      throw new BadRequestException("Remarks are required when the physical count does not match the expected balance");
    }

    const period = monthBoundaries(existing.periodYear, existing.periodMonth);
    const closed = await this.prisma.$transaction(async (tx) => {
      const result = await this.monthCloseRepository.close(id, actor.id);
      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "MONTH_CLOSE",
        entityType: "monthly_closings",
        entityId: id,
        unitId: existing.account.unitId,
        before: existing,
        after: result,
      });
      return result;
    });

    return this.toContractShape(closed, await this.computeSummaryShape(existing.accountId, period));
  }

  async reopenMonth(id: string, reason: string, actor: AuthenticatedUser): Promise<MonthlyClosing> {
    const existing = await this.monthCloseRepository.findClosingById(id);
    if (!existing) {
      throw new NotFoundException(`Monthly closing ${id} not found`);
    }
    this.assertUnitScope(existing.account.unitId, actor);
    if (existing.status !== "CLOSED") {
      throw new ConflictException("Month is not closed");
    }

    const period = monthBoundaries(existing.periodYear, existing.periodMonth);
    const reopened = await this.prisma.$transaction(async (tx) => {
      const result = await this.monthCloseRepository.reopen(id, actor.id, reason);
      await this.auditLogRepository.record(tx, {
        actorId: actor.id,
        actorRole: actor.roleKeys[0] ?? null,
        action: "MONTH_REOPEN",
        entityType: "monthly_closings",
        entityId: id,
        unitId: existing.account.unitId,
        reason,
        before: existing,
        after: result,
      });
      return result;
    });

    return this.toContractShape(reopened, await this.computeSummaryShape(existing.accountId, period));
  }

  private async computeSummaryShape(accountId: string, period: { start: Date; end: Date }) {
    const summary = await this.monthCloseRepository.computeSummary(accountId, period);
    return {
      voucherCount: summary.voucherCount,
      totalExpenditure: summary.totalExpenditure.toFixed(2),
      uncheckedCount: summary.uncheckedCount,
      missingBillCount: summary.missingBillCount,
      negativeBalanceEvents: summary.negativeBalanceEvents,
    };
  }

  private toContractShape(
    row: MonthlyClosingWithRelations,
    summary: MonthlyClosing["summary"],
  ): MonthlyClosing {
    return {
      id: row.id,
      unitId: row.account.unitId,
      unitCode: row.account.unit.code,
      periodYear: row.periodYear,
      periodMonth: row.periodMonth,
      physicalCashCount: row.physicalCashCount ? row.physicalCashCount.toFixed(2) : null,
      countedByName: row.counter?.fullName ?? null,
      countedAt: row.countedAt ? row.countedAt.toISOString() : null,
      expectedBalance: row.expectedBalance ? row.expectedBalance.toFixed(2) : null,
      variance: row.variance ? row.variance.toFixed(2) : null,
      remarks: row.remarks,
      status: row.status,
      closedByName: row.closer?.fullName ?? null,
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
      reopenedByName: row.reopener?.fullName ?? null,
      reopenedAt: row.reopenedAt ? row.reopenedAt.toISOString() : null,
      reopenReason: row.reopenReason,
      summary,
    };
  }

  private assertUnitScope(unitId: string, actor: AuthenticatedUser): void {
    if (actor.unitScope.all) {
      return;
    }
    if (!actor.unitScope.unitIds.includes(unitId)) {
      throw new ForbiddenException("Unit is outside your authorized scope");
    }
  }
}
