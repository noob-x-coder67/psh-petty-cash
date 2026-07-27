import { Injectable } from "@nestjs/common";
import type { ExpenseVoucher, Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

type Client = PrismaService | Prisma.TransactionClient;

export interface CreateVoucherParams {
  voucherNo: string;
  accountId: string;
  expenseDate: Date;
  billDate?: Date;
  vendorName: string;
  vendorBillNo?: string;
  justification: string;
  billTotal: Prisma.Decimal;
  hasBill: boolean;
  missingBillReason?: string;
  isBackdated: boolean;
  enteredBy: string;
}

export interface CreateLineParams {
  voucherId: string;
  lineNo: number;
  description: string;
  category: "BUILDING" | "VEHICLE" | "OTHER";
  amount: Prisma.Decimal;
  otherExplanation?: string;
}

export type ExpenseVoucherWithLines = Prisma.ExpenseVoucherGetPayload<{ include: { lines: true } }>;

@Injectable()
export class ExpensesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findVoucherById(id: string): Promise<ExpenseVoucherWithLines | null> {
    return this.prisma.expenseVoucher.findUnique({ where: { id }, include: { lines: true } });
  }

  /** Keyset pagination (expense_date, id) — not OFFSET, per Build Plan §2.4/NFR-003. Full
   * filter/search capability (RPT-02) is Phase 6; this is the minimal register a single
   * unit needs. */
  async listVouchersForAccount(
    accountId: string,
    cursor?: { expenseDate: Date; id: string },
    limit = 50,
  ): Promise<ExpenseVoucherWithLines[]> {
    return this.prisma.expenseVoucher.findMany({
      where: {
        accountId,
        state: "ACTIVE",
        ...(cursor
          ? {
              OR: [
                { expenseDate: { lt: cursor.expenseDate } },
                { expenseDate: cursor.expenseDate, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ expenseDate: "desc" }, { id: "desc" }],
      take: limit,
      include: { lines: true },
    });
  }

  async findAccountUnitCode(accountId: string): Promise<string | null> {
    const account = await this.prisma.pettyCashAccount.findUnique({
      where: { id: accountId },
      include: { unit: true },
    });
    return account?.unit.code ?? null;
  }

  async findPossibleDuplicates(
    accountId: string,
    vendorName: string,
    expenseDate: Date,
    billTotal: Prisma.Decimal,
  ): Promise<ExpenseVoucher[]> {
    return this.prisma.expenseVoucher.findMany({
      where: { accountId, state: "ACTIVE", vendorName, expenseDate, billTotal },
    });
  }

  async incrementVoucherCounter(accountId: string, year: number, client: Client = this.prisma): Promise<number> {
    const counter = await client.voucherCounter.upsert({
      where: { accountId_year: { accountId, year } },
      create: { accountId, year, lastSeq: 1 },
      update: { lastSeq: { increment: 1 } },
    });
    return counter.lastSeq;
  }

  async createVoucher(params: CreateVoucherParams, client: Client = this.prisma): Promise<ExpenseVoucher> {
    return client.expenseVoucher.create({ data: params });
  }

  async createLine(params: CreateLineParams, client: Client = this.prisma): Promise<void> {
    await client.expenseLine.create({ data: params });
  }

  /** Forces the deferred ck_voucher_totals constraint trigger to fire now, inside the
   * transaction, so a total mismatch fails at a precise point rather than at COMMIT. */
  async enforceTotalsCheckNow(client: Prisma.TransactionClient): Promise<void> {
    await client.$executeRawUnsafe("SET CONSTRAINTS ck_voucher_totals IMMEDIATE");
  }

  async setBalanceAfter(
    voucherId: string,
    balanceAfter: Prisma.Decimal,
    client: Client = this.prisma,
  ): Promise<ExpenseVoucherWithLines> {
    return client.expenseVoucher.update({
      where: { id: voucherId },
      data: { balanceAfter },
      include: { lines: true },
    });
  }

  async findLedgerEntryForVoucher(voucherId: string, client: Client = this.prisma) {
    return client.cashLedgerEntry.findFirst({
      where: { sourceTable: "expense_vouchers", sourceId: voucherId, entryType: "EXPENSE" },
    });
  }

  async updateNonFinancialFields(
    voucherId: string,
    fields: Partial<{
      vendorName: string;
      vendorBillNo: string | null;
      billDate: Date | null;
      justification: string;
      missingBillReason: string | null;
    }>,
    client: Client = this.prisma,
  ): Promise<ExpenseVoucher> {
    return client.expenseVoucher.update({ where: { id: voucherId }, data: fields });
  }

  async markReversed(
    voucherId: string,
    reversedByVoucherId: string,
    client: Client = this.prisma,
  ): Promise<ExpenseVoucher> {
    return client.expenseVoucher.update({
      where: { id: voucherId },
      data: { state: "REVERSED", reversedByVoucherId },
    });
  }

  async markChecked(voucherId: string, checkedBy: string, client: Client = this.prisma): Promise<ExpenseVoucher> {
    return client.expenseVoucher.update({
      where: { id: voucherId },
      data: { checkedBy, checkedAt: new Date() },
    });
  }

  async markUnchecked(voucherId: string, client: Client = this.prisma): Promise<ExpenseVoucher> {
    return client.expenseVoucher.update({
      where: { id: voucherId },
      data: { checkedBy: null, checkedAt: null },
    });
  }

  async createCheckEvent(
    params: { voucherId: string; action: "CHECKED" | "UNCHECKED"; actorId: string; reason?: string },
    client: Client = this.prisma,
  ): Promise<void> {
    await client.receiptCheckEvent.create({ data: params });
  }
}
