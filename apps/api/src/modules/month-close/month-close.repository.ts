import { Injectable } from "@nestjs/common";
import { Prisma, type MonthlyClosingStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

type Client = PrismaService | Prisma.TransactionClient;

const CLOSING_INCLUDE = {
  account: { include: { unit: true } },
  counter: true,
  closer: true,
  reopener: true,
  denominations: true,
} satisfies Prisma.MonthlyClosingInclude;

export type MonthlyClosingWithRelations = Prisma.MonthlyClosingGetPayload<{ include: typeof CLOSING_INCLUDE }>;

export interface UpsertCashCountParams {
  accountId: string;
  periodYear: number;
  periodMonth: number;
  physicalCashCount: Prisma.Decimal;
  expectedBalance: Prisma.Decimal;
  variance: Prisma.Decimal;
  remarks: string | null;
  countedBy: string;
  denominations: Array<{ denomination: number; count: number }>;
}

@Injectable()
export class MonthCloseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findClosing(
    accountId: string,
    periodYear: number,
    periodMonth: number,
    client: Client = this.prisma,
  ): Promise<MonthlyClosingWithRelations | null> {
    return client.monthlyClosing.findUnique({
      where: { accountId_periodYear_periodMonth: { accountId, periodYear, periodMonth } },
      include: CLOSING_INCLUDE,
    });
  }

  async findClosingById(id: string): Promise<MonthlyClosingWithRelations | null> {
    return this.prisma.monthlyClosing.findUnique({ where: { id }, include: CLOSING_INCLUDE });
  }

  // Takes an explicit client so the parent upsert, the denomination-row replace, and the
  // caller's audit-log write all commit or roll back together (rule: audit rows are
  // written inside the same transaction as the change they describe).
  async upsertCashCount(params: UpsertCashCountParams, client: Client = this.prisma): Promise<MonthlyClosingWithRelations> {
    const now = new Date();
    const closing = await client.monthlyClosing.upsert({
      where: {
        accountId_periodYear_periodMonth: {
          accountId: params.accountId,
          periodYear: params.periodYear,
          periodMonth: params.periodMonth,
        },
      },
      create: {
        accountId: params.accountId,
        periodYear: params.periodYear,
        periodMonth: params.periodMonth,
        physicalCashCount: params.physicalCashCount,
        expectedBalance: params.expectedBalance,
        variance: params.variance,
        remarks: params.remarks,
        countedBy: params.countedBy,
        countedAt: now,
      },
      update: {
        physicalCashCount: params.physicalCashCount,
        expectedBalance: params.expectedBalance,
        variance: params.variance,
        remarks: params.remarks,
        countedBy: params.countedBy,
        countedAt: now,
      },
    });

    // Recording a count is itself idempotent/re-recordable before close (upsert keyed on
    // account+period) — a re-submission must fully replace the prior breakdown, not
    // merge into it, so delete-then-recreate rather than a per-row upsert.
    await client.cashCountDenomination.deleteMany({ where: { closingId: closing.id } });
    if (params.denominations.length > 0) {
      await client.cashCountDenomination.createMany({
        data: params.denominations.map((d) => ({ closingId: closing.id, denomination: d.denomination, count: d.count })),
      });
    }

    return client.monthlyClosing.findUniqueOrThrow({ where: { id: closing.id }, include: CLOSING_INCLUDE });
  }

  async close(id: string, closedBy: string): Promise<MonthlyClosingWithRelations> {
    return this.prisma.monthlyClosing.update({
      where: { id },
      data: { status: "CLOSED", closedBy, closedAt: new Date() },
      include: CLOSING_INCLUDE,
    });
  }

  // ADR-0007: closing a period with no MonthlyClosing row at all (no cash count was ever
  // recorded) — creates the row directly in CLOSED status. physicalCashCount/variance/
  // remarks stay null (honest "never counted"), expectedBalance is the caller's
  // already-computed, now-frozen figure (same computeExpectedBalance call recordCashCount
  // uses), so getClosing never falls back to a live recompute for this closed period.
  async closeDirect(
    accountId: string,
    periodYear: number,
    periodMonth: number,
    expectedBalance: Prisma.Decimal,
    closedBy: string,
  ): Promise<MonthlyClosingWithRelations> {
    const now = new Date();
    return this.prisma.monthlyClosing.create({
      data: {
        accountId,
        periodYear,
        periodMonth,
        expectedBalance,
        status: "CLOSED",
        closedBy,
        closedAt: now,
      },
      include: CLOSING_INCLUDE,
    });
  }

  async reopen(id: string, reopenedBy: string, reason: string): Promise<MonthlyClosingWithRelations> {
    return this.prisma.monthlyClosing.update({
      where: { id },
      data: { status: "OPEN", reopenedBy, reopenedAt: new Date(), reopenReason: reason },
      include: CLOSING_INCLUDE,
    });
  }

  /** Same "ledger is truth" computation rebuild-balances.ts/reports.repository.ts both
   * use — the account's net signed balance across every entry strictly before `before`. */
  async computeExpectedBalance(accountId: string, before: Date): Promise<Prisma.Decimal> {
    const rows = await this.prisma.$queryRaw<Array<{ total: Prisma.Decimal | null }>>`
      SELECT SUM(signed_amount) AS total FROM cash_ledger_entries
      WHERE account_id = ${accountId}::uuid AND effective_date < ${before}
    `;
    return rows[0]?.total ?? new Prisma.Decimal(0);
  }

  /** FR-CLS-005: entry count, total expenditure, unchecked receipts, missing bills and
   * negative-balance events for the period — negative-balance events is a plain count
   * of ledger rows with balance_after < 0 in range; RPT-07 is the dedicated report for
   * full streak/duration analysis, this is just the Month Close summary panel. */
  async computeSummary(
    accountId: string,
    period: { start: Date; end: Date },
  ): Promise<{
    voucherCount: number;
    totalExpenditure: Prisma.Decimal;
    uncheckedCount: number;
    missingBillCount: number;
    negativeBalanceEvents: number;
  }> {
    const [vouchers, negativeBalanceEvents] = await Promise.all([
      this.prisma.expenseVoucher.findMany({
        where: { accountId, state: "ACTIVE", expenseDate: { gte: period.start, lt: period.end } },
        select: { billTotal: true, checkedAt: true, hasBill: true },
      }),
      this.prisma.cashLedgerEntry.count({
        where: { accountId, effectiveDate: { gte: period.start, lt: period.end }, balanceAfter: { lt: 0 } },
      }),
    ]);

    let totalExpenditure = new Prisma.Decimal(0);
    let uncheckedCount = 0;
    let missingBillCount = 0;
    for (const voucher of vouchers) {
      totalExpenditure = totalExpenditure.plus(voucher.billTotal);
      if (!voucher.checkedAt) uncheckedCount += 1;
      if (!voucher.hasBill) missingBillCount += 1;
    }

    return { voucherCount: vouchers.length, totalExpenditure, uncheckedCount, missingBillCount, negativeBalanceEvents };
  }

  /** Used by ReplenishmentsModule's compliance evaluator (Build Plan §3.1's
   * ReplenishmentsModule owns GET /compliance/:unitId, but the underlying data is a
   * MonthlyClosing query — kept here rather than duplicated). */
  async findStatusesForPeriods(
    accountId: string,
    periods: Array<{ year: number; month: number }>,
  ): Promise<Map<string, MonthlyClosingStatus>> {
    const byAccount = await this.findStatusesForAccountsAndPeriods([accountId], periods);
    return byAccount.get(accountId) ?? new Map();
  }

  /** Batch form used by cross-unit reports so one report does not fan out into one
   * concurrent database query per petty-cash account. */
  async findStatusesForAccountsAndPeriods(
    accountIds: string[],
    periods: Array<{ year: number; month: number }>,
  ): Promise<Map<string, Map<string, MonthlyClosingStatus>>> {
    if (accountIds.length === 0 || periods.length === 0) return new Map();
    const rows = await this.prisma.monthlyClosing.findMany({
      where: {
        accountId: { in: accountIds },
        OR: periods.map((p) => ({ periodYear: p.year, periodMonth: p.month })),
      },
      select: { accountId: true, periodYear: true, periodMonth: true, status: true },
    });
    const result = new Map<string, Map<string, MonthlyClosingStatus>>();
    for (const row of rows) {
      const statuses = result.get(row.accountId) ?? new Map<string, MonthlyClosingStatus>();
      statuses.set(`${row.periodYear}-${row.periodMonth}`, row.status);
      result.set(row.accountId, statuses);
    }
    return result;
  }
}
