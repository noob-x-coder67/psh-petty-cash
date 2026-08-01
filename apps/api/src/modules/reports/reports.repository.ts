import { Injectable } from "@nestjs/common";
import { Prisma, type LedgerEntryType } from "@prisma/client";
import type { ReportFilter } from "@psh/contracts";
import { PrismaService } from "../../common/prisma/prisma.service";
import { LEGACY_CATEGORY_NAME, legacyCategoryFromName } from "../categories/category-compat";

export interface ReportPeriod {
  start: Date;
  end: Date;
}

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Every petty-cash account with its unit, optionally restricted to a unit allow-list.
   * PSH-ISB structurally never appears (BR-016 — it never has an account). */
  async findAccountsWithUnits(unitIds: string[] | null) {
    return this.prisma.pettyCashAccount.findMany({
      where: unitIds ? { unitId: { in: unitIds } } : undefined,
      include: { unit: true },
      orderBy: { unit: { code: "asc" } },
    });
  }

  /** Net signed balance across every ledger entry strictly before `before`, per account —
   * the same "ledger is truth" computation scripts/rebuild-balances.ts uses, scoped to a
   * point in time instead of "now". */
  async sumSignedBefore(accountIds: string[], before: Date): Promise<Map<string, Prisma.Decimal>> {
    if (accountIds.length === 0) return new Map();
    const rows = await this.prisma.cashLedgerEntry.groupBy({
      by: ["accountId", "direction"],
      where: { accountId: { in: accountIds }, effectiveDate: { lt: before } },
      _sum: { amount: true },
    });
    const result = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      const signed = (row._sum.amount ?? new Prisma.Decimal(0)).times(row.direction);
      result.set(row.accountId, (result.get(row.accountId) ?? new Prisma.Decimal(0)).plus(signed));
    }
    return result;
  }

  /** Per-account, per-entry-type signed sums within [period.start, period.end). */
  async sumSignedByTypeInRange(
    accountIds: string[],
    period: ReportPeriod,
  ): Promise<Map<string, Map<LedgerEntryType, Prisma.Decimal>>> {
    if (accountIds.length === 0) return new Map();
    const rows = await this.prisma.cashLedgerEntry.groupBy({
      by: ["accountId", "entryType", "direction"],
      where: { accountId: { in: accountIds }, effectiveDate: { gte: period.start, lt: period.end } },
      _sum: { amount: true },
    });
    const result = new Map<string, Map<LedgerEntryType, Prisma.Decimal>>();
    for (const row of rows) {
      const signed = (row._sum.amount ?? new Prisma.Decimal(0)).times(row.direction);
      const accMap = result.get(row.accountId) ?? new Map<LedgerEntryType, Prisma.Decimal>();
      accMap.set(row.entryType, (accMap.get(row.entryType) ?? new Prisma.Decimal(0)).plus(signed));
      result.set(row.accountId, accMap);
    }
    return result;
  }

  /** RPT-03/04/06 all read active-voucher lines with the same joins; only the projected
   * columns and grouping differ, so the where-clause builder is shared. */
  private buildLineWhere(unitIds: string[] | null, period: ReportPeriod, filter: ReportFilter): Prisma.ExpenseLineWhereInput {
    const voucherWhere: Prisma.ExpenseVoucherWhereInput = {
      state: "ACTIVE",
      expenseDate: { gte: period.start, lt: period.end },
      account: unitIds ? { unitId: { in: unitIds } } : undefined,
    };
    if (filter.vendorSearch) {
      voucherWhere.vendorName = { contains: filter.vendorSearch, mode: "insensitive" };
    }
    if (filter.checked !== undefined) {
      voucherWhere.checkedAt = filter.checked ? { not: null } : null;
    }
    if (filter.hasBill !== undefined) {
      voucherWhere.hasBill = filter.hasBill;
    }
    if (filter.isBackdated !== undefined) {
      voucherWhere.isBackdated = filter.isBackdated;
    }
    if (filter.amountMin || filter.amountMax) {
      voucherWhere.billTotal = {
        ...(filter.amountMin ? { gte: new Prisma.Decimal(filter.amountMin) } : {}),
        ...(filter.amountMax ? { lte: new Prisma.Decimal(filter.amountMax) } : {}),
      };
    }
    if (filter.enteredBy) {
      voucherWhere.enteredBy = filter.enteredBy;
    }
    if (filter.checkedBy) {
      voucherWhere.checkedBy = filter.checkedBy;
    }
    return {
      voucher: voucherWhere,
      category: filter.category ? { name: LEGACY_CATEGORY_NAME[filter.category] } : undefined,
    };
  }

  async listExpenseLines(unitIds: string[] | null, period: ReportPeriod, filter: ReportFilter) {
    const lines = await this.prisma.expenseLine.findMany({
      where: this.buildLineWhere(unitIds, period, filter),
      include: { category: true, voucher: { include: { account: { include: { unit: true } } } } },
      orderBy: [{ voucher: { expenseDate: "asc" } }, { voucher: { voucherNo: "asc" } }, { lineNo: "asc" }],
    });
    return lines.map(({ category, ...line }) => ({
      ...line,
      category: legacyCategoryFromName(category.name),
    }));
  }

  async listVouchersForReceiptControl(unitIds: string[] | null, period: ReportPeriod, filter: ReportFilter) {
    const where: Prisma.ExpenseVoucherWhereInput = {
      state: "ACTIVE",
      expenseDate: { gte: period.start, lt: period.end },
      account: unitIds ? { unitId: { in: unitIds } } : undefined,
    };
    if (filter.vendorSearch) {
      where.vendorName = { contains: filter.vendorSearch, mode: "insensitive" };
    }
    if (filter.checked !== undefined) {
      where.checkedAt = filter.checked ? { not: null } : null;
    }
    if (filter.hasBill !== undefined) {
      where.hasBill = filter.hasBill;
    }
    if (filter.enteredBy) {
      where.enteredBy = filter.enteredBy;
    }
    if (filter.checkedBy) {
      where.checkedBy = filter.checkedBy;
    }
    return this.prisma.expenseVoucher.findMany({
      where,
      include: { account: { include: { unit: true } } },
      orderBy: [{ expenseDate: "asc" }, { voucherNo: "asc" }],
    });
  }

  /** RPT-02: ledger entries within the filtered period, for display. */
  async listLedgerEntriesInRange(unitIds: string[] | null, period: ReportPeriod) {
    return this.prisma.cashLedgerEntry.findMany({
      where: {
        account: unitIds ? { unitId: { in: unitIds } } : undefined,
        effectiveDate: { gte: period.start, lt: period.end },
      },
      include: { account: { include: { unit: true } } },
      orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
    });
  }

  /** RPT-07: every ledger movement for the given accounts in effective-date order — a
   * negative-balance streak can start well before any date-range filter the caller
   * applies. The service reconstructs running balances from these signed movements;
   * stored balanceAfter snapshots are in posting order and cannot be reordered safely. */
  async listAllLedgerEntriesChronological(accountIds: string[]) {
    if (accountIds.length === 0) return [];
    return this.prisma.cashLedgerEntry.findMany({
      where: { accountId: { in: accountIds } },
      orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
    });
  }

  /** Resolves a ledger entry's sourceId back to its voucher_no when sourceTable is
   * expense_vouchers — used to label which voucher triggered a negative streak (RPT-07).
   * Not a Prisma relation (source_id is a polymorphic pointer across several tables). */
  async findVoucherNosByIds(voucherIds: string[]): Promise<Map<string, string>> {
    if (voucherIds.length === 0) return new Map();
    const vouchers = await this.prisma.expenseVoucher.findMany({
      where: { id: { in: voucherIds } },
      select: { id: true, voucherNo: true },
    });
    return new Map(vouchers.map((v) => [v.id, v.voucherNo]));
  }

  /** RPT-05: spend grouped by exact vendor name across every selected unit combined —
   * a vendor can serve more than one unit, so this is deliberately cross-unit, not
   * per-unit, aggregation. */
  async groupVouchersByVendor(unitIds: string[] | null, period: ReportPeriod, filter: ReportFilter) {
    const where: Prisma.ExpenseVoucherWhereInput = {
      state: "ACTIVE",
      expenseDate: { gte: period.start, lt: period.end },
      account: unitIds ? { unitId: { in: unitIds } } : undefined,
    };
    if (filter.vendorSearch) {
      where.vendorName = { contains: filter.vendorSearch, mode: "insensitive" };
    }
    const grouped = await this.prisma.expenseVoucher.groupBy({
      by: ["vendorName"],
      where,
      _sum: { billTotal: true },
      _count: true,
      _max: { expenseDate: true },
    });
    return grouped;
  }

  /** RPT-08: allocations issued for the selected units within the period (by issue date). */
  async listAllocations(unitIds: string[] | null, period: ReportPeriod) {
    return this.prisma.cashAllocation.findMany({
      where: {
        account: unitIds ? { unitId: { in: unitIds } } : undefined,
        issueDate: { gte: period.start, lt: period.end },
      },
      include: { account: { include: { unit: true } }, confirmer: true },
      orderBy: { issueDate: "asc" },
    });
  }

  /** RPT-11: backdated vouchers in range. */
  async listBackdatedVouchers(unitIds: string[] | null, period: ReportPeriod) {
    return this.prisma.expenseVoucher.findMany({
      where: {
        state: "ACTIVE",
        isBackdated: true,
        expenseDate: { gte: period.start, lt: period.end },
        account: unitIds ? { unitId: { in: unitIds } } : undefined,
      },
      include: { account: { include: { unit: true } } },
      orderBy: { expenseDate: "asc" },
    });
  }

  /** RPT-11: groups of vouchers sharing account+vendor+date+amount (the exact duplicate
   * definition ExpensesRepository.findPossibleDuplicates already uses at creation time),
   * restricted to groups with more than one member. */
  async listDuplicateVoucherGroups(unitIds: string[] | null, period: ReportPeriod) {
    const vouchers = await this.prisma.expenseVoucher.findMany({
      where: {
        state: "ACTIVE",
        expenseDate: { gte: period.start, lt: period.end },
        account: unitIds ? { unitId: { in: unitIds } } : undefined,
      },
      include: { account: { include: { unit: true } } },
      orderBy: { expenseDate: "asc" },
    });
    const groups = new Map<string, typeof vouchers>();
    for (const voucher of vouchers) {
      const key = `${voucher.accountId}|${voucher.vendorName}|${voucher.expenseDate.toISOString()}|${voucher.billTotal.toString()}`;
      const group = groups.get(key) ?? [];
      group.push(voucher);
      groups.set(key, group);
    }
    return Array.from(groups.values()).filter((group) => group.length > 1);
  }

  /** RPT-12: attachments joined to their voucher/unit, for the voucher-to-file index. */
  async listAttachmentsForIndex(unitIds: string[] | null, period: ReportPeriod) {
    return this.prisma.attachment.findMany({
      where: {
        voucher: {
          expenseDate: { gte: period.start, lt: period.end },
          account: unitIds ? { unitId: { in: unitIds } } : undefined,
        },
      },
      include: { voucher: { include: { account: { include: { unit: true } } } }, uploader: true },
      orderBy: { uploadedAt: "asc" },
    });
  }

  /** RPT-13: raw activity counts per user, in four separate groupBys (entries, checks,
   * edits, exports) — merged and named in the service, since each source table has a
   * different actor column and a different "which date field" period filter. */
  async countVoucherEntriesByUser(unitIds: string[] | null, period: ReportPeriod): Promise<Map<string, number>> {
    const rows = await this.prisma.expenseVoucher.groupBy({
      by: ["enteredBy"],
      where: {
        state: "ACTIVE",
        expenseDate: { gte: period.start, lt: period.end },
        account: unitIds ? { unitId: { in: unitIds } } : undefined,
      },
      _count: true,
    });
    return new Map(rows.map((row) => [row.enteredBy, row._count]));
  }

  async countVoucherChecksByUser(unitIds: string[] | null, period: ReportPeriod): Promise<Map<string, number>> {
    const rows = await this.prisma.expenseVoucher.groupBy({
      by: ["checkedBy"],
      where: {
        checkedBy: { not: null },
        checkedAt: { gte: period.start, lt: period.end },
        account: unitIds ? { unitId: { in: unitIds } } : undefined,
      },
      _count: true,
    });
    return new Map(rows.filter((row) => row.checkedBy).map((row) => [row.checkedBy as string, row._count]));
  }

  async countAuditActionsByActor(action: string, period: ReportPeriod): Promise<Map<string, number>> {
    const rows = await this.prisma.auditLog.groupBy({
      by: ["actorId"],
      where: { action, actorId: { not: null }, occurredAt: { gte: period.start, lt: period.end } },
      _count: true,
    });
    return new Map(rows.filter((row) => row.actorId).map((row) => [row.actorId as string, row._count]));
  }

  async countExportsByUser(period: ReportPeriod): Promise<Map<string, number>> {
    const rows = await this.prisma.reportExport.groupBy({
      by: ["generatedBy"],
      where: { generatedAt: { gte: period.start, lt: period.end } },
      _count: true,
    });
    return new Map(rows.map((row) => [row.generatedBy, row._count]));
  }

  async findUsersByIds(userIds: string[]) {
    if (userIds.length === 0) return [];
    return this.prisma.user.findMany({ where: { id: { in: userIds } } });
  }

  /** audit_logs.unit_id is a bare uuid column (no FK, same reasoning as actor_id) — this
   * resolves the handful of distinct unit ids a result page actually references. */
  async findUnitCodesByIds(unitIds: string[]): Promise<Map<string, string>> {
    if (unitIds.length === 0) return new Map();
    const units = await this.prisma.organizationalUnit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, code: true },
    });
    return new Map(units.map((unit) => [unit.id, unit.code]));
  }

  /** RPT-14: audit_logs has no FK to users (rows must stay legible even if the actor is
   * later deleted), so actorSearch resolves to a set of matching user ids first (this
   * method), then filters audit_logs by actorId — same two-step shape findUsersByIds/
   * findUnitCodesByIds already use for display-side name resolution. */
  async findUserIdsByNameSearch(search: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { fullName: { contains: search, mode: "insensitive" } },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  /** Keyset pagination (occurredAt, id) — not OFFSET, mirroring
   * ExpensesRepository.listVouchersForAccount's exact cursor shape. `actorIds` is the
   * pre-resolved result of an actorSearch filter (undefined = not filtering by actor;
   * an array, possibly empty, = filtering to exactly those actors). */
  async listAuditLogs(
    unitIds: string[] | null,
    period: ReportPeriod,
    filter: { action?: string; entityType?: string; actorIds?: string[] } = {},
    cursor?: { occurredAt: Date; id: string },
    limit = 50,
  ) {
    const andConditions: Prisma.AuditLogWhereInput[] = [];
    if (cursor) {
      andConditions.push({
        OR: [
          { occurredAt: { lt: cursor.occurredAt } },
          { occurredAt: cursor.occurredAt, id: { lt: cursor.id } },
        ],
      });
    }

    return this.prisma.auditLog.findMany({
      where: {
        occurredAt: { gte: period.start, lt: period.end },
        unitId: unitIds ? { in: unitIds } : undefined,
        ...(filter.action ? { action: filter.action } : {}),
        ...(filter.entityType ? { entityType: filter.entityType } : {}),
        ...(filter.actorIds ? { actorId: { in: filter.actorIds } } : {}),
        ...(andConditions.length > 0 ? { AND: andConditions } : {}),
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: limit,
    });
  }

  /** RPT-10: monthly_closings rows for one specific (year, month) across the given
   * accounts — a unit with no row yet for that month is handled by the caller (an
   * account with no matching entry here just gets a synthesized OPEN/empty row), not by
   * this query, since a plain findMany can't invent rows for the missing side of a
   * one-to-zero-or-one relationship. */
  async findMonthlyClosingsForPeriod(accountIds: string[], periodYear: number, periodMonth: number) {
    if (accountIds.length === 0) return [];
    return this.prisma.monthlyClosing.findMany({
      where: { accountId: { in: accountIds }, periodYear, periodMonth },
    });
  }
}
