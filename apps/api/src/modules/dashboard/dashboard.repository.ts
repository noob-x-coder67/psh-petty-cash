import { Injectable } from "@nestjs/common";
import { Prisma, type LedgerEntryType } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Every petty-cash account with its unit — PSH-ISB never appears since it never has
   * an account (BR-016), not because this query specifically excludes it. */
  async findAccountsWithUnits(unitIds?: string[]) {
    return this.prisma.pettyCashAccount.findMany({
      where: unitIds ? { unitId: { in: unitIds } } : undefined,
      include: { unit: true },
      orderBy: { unit: { code: "asc" } },
    });
  }

  async countUncheckedForAccount(accountId: string): Promise<number> {
    return this.prisma.expenseVoucher.count({
      where: { accountId, state: "ACTIVE", checkedAt: null },
    });
  }

  async sumLedgerByType(
    accountIds: string[],
    entryTypes: LedgerEntryType[],
    period: { start: Date; end: Date },
  ): Promise<Prisma.Decimal> {
    if (accountIds.length === 0) {
      return new Prisma.Decimal(0);
    }
    const result = await this.prisma.cashLedgerEntry.aggregate({
      where: {
        accountId: { in: accountIds },
        entryType: { in: entryTypes },
        effectiveDate: { gte: period.start, lt: period.end },
      },
      _sum: { amount: true },
    });
    return result._sum.amount ?? new Prisma.Decimal(0);
  }

  async listUncheckedQueue(accountIds: string[], limit: number) {
    if (accountIds.length === 0) {
      return [];
    }
    return this.prisma.expenseVoucher.findMany({
      where: { accountId: { in: accountIds }, state: "ACTIVE", checkedAt: null },
      orderBy: [{ expenseDate: "desc" }, { id: "desc" }],
      take: limit,
      include: { account: { include: { unit: true } } },
    });
  }

  async listRecentLedgerEntries(accountId: string, limit: number) {
    return this.prisma.cashLedgerEntry.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
