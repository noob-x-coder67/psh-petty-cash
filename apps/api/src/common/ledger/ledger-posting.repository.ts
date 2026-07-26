import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type CashLedgerEntry, type LedgerEntryType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { computeBalanceAfter, type LedgerDirection } from "./ledger.posting";

export interface PostLedgerEntryParams {
  accountId: string;
  entryType: LedgerEntryType;
  direction: LedgerDirection;
  amount: Prisma.Decimal;
  effectiveDate: Date;
  sourceTable: string;
  sourceId: string;
  createdBy: string;
}

/**
 * The one path that must be exactly right (Build Plan §2.5): row-locks the account so
 * concurrent postings serialize into a correct balance_after chain, then posts the
 * ledger entry and updates the cached balance in the same transaction. Shared by
 * AllocationsModule now; ExpensesModule (Phase 3) posts through the same method.
 */
@Injectable()
export class LedgerPostingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async postEntry(params: PostLedgerEntryParams): Promise<CashLedgerEntry> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ cached_balance: Prisma.Decimal }>>`
        SELECT cached_balance FROM petty_cash_accounts WHERE id = ${params.accountId}::uuid FOR UPDATE
      `;
      const account = rows[0];
      if (!account) {
        throw new NotFoundException(`Petty cash account ${params.accountId} not found`);
      }

      const balanceAfter = computeBalanceAfter(account.cached_balance, params.direction, params.amount);

      const entry = await tx.cashLedgerEntry.create({
        data: {
          accountId: params.accountId,
          entryType: params.entryType,
          direction: params.direction,
          amount: params.amount,
          effectiveDate: params.effectiveDate,
          sourceTable: params.sourceTable,
          sourceId: params.sourceId,
          balanceAfter,
          createdBy: params.createdBy,
        },
      });

      await tx.pettyCashAccount.update({
        where: { id: params.accountId },
        data: { cachedBalance: balanceAfter, cachedBalanceAt: new Date() },
      });

      return entry;
    });
  }
}
