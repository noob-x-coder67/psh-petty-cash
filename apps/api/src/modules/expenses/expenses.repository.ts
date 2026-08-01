import { Injectable } from "@nestjs/common";
import type { ExpenseVoucher, Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  LEGACY_CATEGORY_NAME,
  legacyCategoryFromName,
  type LegacyExpenseCategory,
} from "../categories/category-compat";

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
  category: LegacyExpenseCategory;
  amount: Prisma.Decimal;
  otherExplanation?: string;
}

export interface VoucherListFilters {
  search?: string;
  checked?: boolean;
  category?: LegacyExpenseCategory;
  dateFrom?: Date;
  dateTo?: Date;
}

// Attachments are select()ed, never included wholesale — data/storageKey (the raw
// bytes) must never reach the API response (same reasoning as the upload endpoint).
const ATTACHMENTS_INCLUDE = {
  where: { deletedAt: null },
  orderBy: { pageNo: "asc" as const },
  select: {
    id: true,
    voucherId: true,
    driver: true,
    fileName: true,
    mimeType: true,
    sizeBytes: true,
    sha256: true,
    pageNo: true,
    uploadedBy: true,
    uploadedAt: true,
    deletedAt: true,
    deletedBy: true,
    archiveId: true,
  },
} satisfies Prisma.ExpenseVoucher$attachmentsArgs;

const LINES_INCLUDE = { include: { category: true } } satisfies Prisma.ExpenseVoucher$linesArgs;

type ExpenseLineWithCategoryRecord = Prisma.ExpenseLineGetPayload<typeof LINES_INCLUDE>;
type CompatibilityExpenseLine = Omit<ExpenseLineWithCategoryRecord, "category"> & {
  category: LegacyExpenseCategory;
};

type ExpenseVoucherDbWithLines = Prisma.ExpenseVoucherGetPayload<{
  include: { lines: typeof LINES_INCLUDE; attachments: typeof ATTACHMENTS_INCLUDE };
}>;

export type ExpenseVoucherWithLines = Omit<ExpenseVoucherDbWithLines, "lines"> & {
  lines: CompatibilityExpenseLine[];
};

function withCompatibilityLines<T extends { lines: ExpenseLineWithCategoryRecord[] }>(
  voucher: T,
): Omit<T, "lines"> & { lines: CompatibilityExpenseLine[] } {
  return {
    ...voucher,
    lines: voucher.lines.map(({ category, ...line }) => ({
      ...line,
      category: legacyCategoryFromName(category.name),
    })),
  };
}

const REGISTER_INCLUDE = {
  lines: LINES_INCLUDE,
  attachments: ATTACHMENTS_INCLUDE,
  account: {
    select: {
      unit: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.ExpenseVoucherInclude;

type ExpenseVoucherRegisterRecord = Prisma.ExpenseVoucherGetPayload<{
  include: typeof REGISTER_INCLUDE;
}>;

export type ExpenseVoucherRegisterRow = ExpenseVoucherWithLines & {
  unit: ExpenseVoucherRegisterRecord["account"]["unit"];
};

@Injectable()
export class ExpensesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findVoucherById(id: string): Promise<ExpenseVoucherWithLines | null> {
    const voucher = await this.prisma.expenseVoucher.findUnique({
      where: { id },
      include: { lines: LINES_INCLUDE, attachments: ATTACHMENTS_INCLUDE },
    });
    return voucher ? withCompatibilityLines(voucher) : null;
  }

  /** Keyset pagination (expense_date, id) — not OFFSET, per Build Plan §2.4/NFR-003.
   * Search/filters here are the Register's own (SRS §12.6: global search across
   * voucher/vendor/justification, category/checked/date-range chips) — plain ILIKE via
   * Prisma's query builder, not the ix_voucher_search tsvector/trigram indexes (those
   * stay reserved for Reports Studio's heavier filter engine, RPT-02, Phase 6, which
   * needs real ranked full-text search across a much larger dataset). Both OR-based
   * conditions (search, keyset cursor) must combine under AND — object-literal spread
   * would let the second "OR" key silently clobber the first. */
  async listVouchersForAccounts(
    accountIds: string[],
    filters: VoucherListFilters = {},
    cursor?: { expenseDate: Date; id: string },
    limit = 50,
  ): Promise<ExpenseVoucherRegisterRow[]> {
    if (accountIds.length === 0) {
      return [];
    }
    const andConditions: Prisma.ExpenseVoucherWhereInput[] = [];
    if (filters.search) {
      andConditions.push({
        OR: [
          { voucherNo: { contains: filters.search, mode: "insensitive" } },
          { vendorName: { contains: filters.search, mode: "insensitive" } },
          { justification: { contains: filters.search, mode: "insensitive" } },
        ],
      });
    }
    if (cursor) {
      andConditions.push({
        OR: [
          { expenseDate: { lt: cursor.expenseDate } },
          { expenseDate: cursor.expenseDate, id: { lt: cursor.id } },
        ],
      });
    }

    const records: ExpenseVoucherRegisterRecord[] = await this.prisma.expenseVoucher.findMany({
      where: {
        accountId: { in: accountIds },
        state: "ACTIVE",
        ...(filters.checked !== undefined
          ? { checkedAt: filters.checked ? { not: null } : null }
          : {}),
        ...(filters.category
          ? { lines: { some: { category: { name: LEGACY_CATEGORY_NAME[filters.category] } } } }
          : {}),
        ...(filters.dateFrom || filters.dateTo
          ? {
              expenseDate: {
                ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
                ...(filters.dateTo ? { lte: filters.dateTo } : {}),
              },
            }
          : {}),
        ...(andConditions.length > 0 ? { AND: andConditions } : {}),
      },
      orderBy: [{ expenseDate: "desc" }, { id: "desc" }],
      take: limit,
      include: REGISTER_INCLUDE,
    });

    return records.map(({ account, ...voucher }) => ({
      ...withCompatibilityLines(voucher),
      unit: account.unit,
    }));
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

  async incrementVoucherCounter(
    accountId: string,
    year: number,
    client: Client = this.prisma,
  ): Promise<number> {
    const counter = await client.voucherCounter.upsert({
      where: { accountId_year: { accountId, year } },
      create: { accountId, year, lastSeq: 1 },
      update: { lastSeq: { increment: 1 } },
    });
    return counter.lastSeq;
  }

  async createVoucher(
    params: CreateVoucherParams,
    client: Client = this.prisma,
  ): Promise<ExpenseVoucher> {
    return client.expenseVoucher.create({ data: params });
  }

  async createLine(params: CreateLineParams, client: Client = this.prisma): Promise<void> {
    const category = await client.expenseCategory.findUniqueOrThrow({
      where: { name: LEGACY_CATEGORY_NAME[params.category] },
      select: { id: true },
    });
    const { category: _legacyCategory, ...line } = params;
    await client.expenseLine.create({ data: { ...line, categoryId: category.id } });
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
    const voucher = await client.expenseVoucher.update({
      where: { id: voucherId },
      data: { balanceAfter },
      include: { lines: LINES_INCLUDE, attachments: ATTACHMENTS_INCLUDE },
    });
    return withCompatibilityLines(voucher);
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

  async markChecked(
    voucherId: string,
    checkedBy: string,
    client: Client = this.prisma,
  ): Promise<ExpenseVoucher> {
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
    params: {
      voucherId: string;
      action: "CHECKED" | "UNCHECKED";
      actorId: string;
      reason?: string;
    },
    client: Client = this.prisma,
  ): Promise<void> {
    await client.receiptCheckEvent.create({ data: params });
  }
}
