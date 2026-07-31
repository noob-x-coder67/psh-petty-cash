import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { DashboardFinanceResponse, DashboardUnitResponse, UnitOnHold } from "@psh/contracts";
import { AccountsRepository } from "../accounts/accounts.repository";
import { MonthCloseRepository } from "../month-close/month-close.repository";
import { evaluateThreeMonthCompliance, precedingThreeMonths } from "../month-close/replenishments.rules";
import { DashboardRepository } from "./dashboard.repository";
import { currentKarachiPeriod } from "./period.util";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly dashboardRepository: DashboardRepository,
    private readonly accountsRepository: AccountsRepository,
    private readonly monthCloseRepository: MonthCloseRepository,
  ) {}

  // dashboard.view_all is gated to the same roles that get unitScope.all — this check
  // is a second, service-level backstop, not the only enforcement (permission +
  // RequiresUnitScope guard already run first).
  async getFinanceDashboard(user: AuthenticatedUser): Promise<DashboardFinanceResponse> {
    if (!user.unitScope.all) {
      throw new ForbiddenException("Finance Command Center requires cross-unit access");
    }

    const period = currentKarachiPeriod();
    const accounts = await this.dashboardRepository.findAccountsWithUnits();
    const accountIds = accounts.map((account) => account.id);

    const [cashIssued, spending, uncheckedQueueRows, uncheckedCounts] = await Promise.all([
      this.dashboardRepository.sumLedgerByType(accountIds, ["ALLOCATION", "REPLENISHMENT"], period),
      this.dashboardRepository.sumNetSpend(accountIds, period),
      this.dashboardRepository.listUncheckedQueue(accountIds, 10),
      Promise.all(accounts.map((account) => this.dashboardRepository.countUncheckedForAccount(account.id))),
    ]);

    const expectedCash = accounts.reduce(
      (sum, account) => sum.plus(account.cachedBalance),
      new Prisma.Decimal(0),
    );
    const negativeCount = accounts.filter((account) => account.cachedBalance.isNegative()).length;

    // FR-REP-003/Phase 7 compliance ribbon: which units would currently be held if a
    // replenishment were issued this month (any of the preceding 3 months not CLOSED).
    const currentYear = period.start.getUTCFullYear();
    const currentMonth = period.start.getUTCMonth() + 1;
    const requiredPeriods = precedingThreeMonths(currentYear, currentMonth);
    const holdChecks = await Promise.all(
      accounts.map(async (account) => {
        const statuses = await this.monthCloseRepository.findStatusesForPeriods(account.id, requiredPeriods);
        return evaluateThreeMonthCompliance(currentYear, currentMonth, statuses).isCompliant;
      }),
    );
    const unitsOnHold: UnitOnHold[] = accounts
      .filter((_, index) => !holdChecks[index])
      .map((account) => ({ unitId: account.unit.id, unitCode: account.unit.code, unitName: account.unit.name }));

    return {
      kpis: {
        cashIssued: cashIssued.toFixed(2),
        spending: spending.toFixed(2),
        expectedCash: expectedCash.toFixed(2),
        uncheckedCount: uncheckedCounts.reduce((sum, count) => sum + count, 0),
        negativeCount,
      },
      units: accounts.map((account, index) => ({
        unitId: account.unit.id,
        unitCode: account.unit.code,
        unitName: account.unit.name,
        balance: account.cachedBalance.toFixed(2),
        uncheckedCount: uncheckedCounts[index] ?? 0,
      })),
      uncheckedQueue: uncheckedQueueRows.map((voucher) => ({
        voucherId: voucher.id,
        voucherNo: voucher.voucherNo,
        unitCode: voucher.account.unit.code,
        vendorName: voucher.vendorName,
        billTotal: voucher.billTotal.toFixed(2),
        expenseDate: toDateOnly(voucher.expenseDate),
      })),
      unitsOnHold,
    };
  }

  async getUnitDashboard(unitId: string, user: AuthenticatedUser): Promise<DashboardUnitResponse> {
    if (!user.unitScope.all && !user.unitScope.unitIds.includes(unitId)) {
      throw new ForbiddenException("Unit is outside your authorized scope");
    }
    const unit = await this.accountsRepository.findUnitById(unitId);
    if (!unit) {
      throw new NotFoundException(`Unit ${unitId} not found`);
    }
    const account = await this.accountsRepository.findByUnitId(unitId);
    if (!account) {
      throw new NotFoundException(`Unit ${unitId} has no petty-cash account`);
    }

    const period = currentKarachiPeriod();
    const [cashReceived, spent, recentEntries] = await Promise.all([
      this.dashboardRepository.sumLedgerByType([account.id], ["ALLOCATION", "REPLENISHMENT"], period),
      this.dashboardRepository.sumNetSpend([account.id], period),
      this.dashboardRepository.listRecentLedgerEntries(account.id, 10),
    ]);

    return {
      unit: { id: unit.id, code: unit.code, name: unit.name },
      balance: account.cachedBalance.toFixed(2),
      approvedFloat: account.approvedFloat.toFixed(2),
      period: {
        cashReceived: cashReceived.toFixed(2),
        spent: spent.toFixed(2),
        expectedCash: account.cachedBalance.toFixed(2),
      },
      recentEntries: recentEntries.map((entry) => ({
        id: entry.id,
        entryType: entry.entryType,
        direction: entry.direction,
        amount: entry.amount.toFixed(2),
        effectiveDate: toDateOnly(entry.effectiveDate),
        balanceAfter: entry.balanceAfter.toFixed(2),
      })),
    };
  }
}
