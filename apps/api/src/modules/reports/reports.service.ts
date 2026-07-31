import { Injectable, NotImplementedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  ReportDatasetResponse,
  ReportFilter,
  ReportKey,
  Rpt01RowSchema,
  Rpt04CategoryRowSchema,
  Rpt02RowSchema,
  Rpt05RowSchema,
  Rpt07RowSchema,
  Rpt08RowSchema,
  Rpt09RowSchema,
  Rpt10RowSchema,
  Rpt11RowSchema,
  Rpt12RowSchema,
  Rpt13RowSchema,
  Rpt14RowSchema,
  Rpt15RowSchema,
  Rpt16RowSchema,
} from "@psh/contracts";
import type { z } from "zod";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { MonthCloseRepository } from "../month-close/month-close.repository";
import { evaluateThreeMonthCompliance, precedingThreeMonths } from "../month-close/replenishments.rules";
import { resolveReportPeriod, resolveScopedUnitIds } from "./reports.filters";
import {
  computeCategoryPercentage,
  computeCheckAgeDays,
  computeConsolidatedCashAmounts,
  computeEffectiveBalancePoints,
  computeNegativeBalanceStreaks,
} from "./reports.rules";
import { ReportsRepository, type ReportPeriod } from "./reports.repository";

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type Rpt01Row = z.infer<typeof Rpt01RowSchema>;
type Rpt04CategoryRow = z.infer<typeof Rpt04CategoryRowSchema>;
type Rpt02Row = z.infer<typeof Rpt02RowSchema>;
type Rpt05Row = z.infer<typeof Rpt05RowSchema>;
type Rpt07Row = z.infer<typeof Rpt07RowSchema>;
type Rpt08Row = z.infer<typeof Rpt08RowSchema>;
type Rpt11Row = z.infer<typeof Rpt11RowSchema>;
type Rpt12Row = z.infer<typeof Rpt12RowSchema>;
type Rpt13Row = z.infer<typeof Rpt13RowSchema>;
type Rpt14Row = z.infer<typeof Rpt14RowSchema>;
type Rpt15Row = z.infer<typeof Rpt15RowSchema>;
type Rpt16Row = z.infer<typeof Rpt16RowSchema>;
type Rpt09Row = z.infer<typeof Rpt09RowSchema>;
type Rpt10Row = z.infer<typeof Rpt10RowSchema>;

@Injectable()
export class ReportsService {
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly monthCloseRepository: MonthCloseRepository,
  ) {}

  async getReport(
    reportKey: ReportKey,
    filter: ReportFilter,
    user: AuthenticatedUser,
    // RPT-14-only — every other report key ignores this, same "accepted but has no
    // target here" stance as the RPT-14-only filter fields on ReportFilter itself.
    auditCursor?: { occurredAt: Date; id: string },
  ): Promise<ReportDatasetResponse> {
    const unitIds = resolveScopedUnitIds(filter.unitIds, user);
    const period = resolveReportPeriod(filter);
    const envelope = {
      generatedAt: new Date().toISOString(),
      generatedBy: { id: user.id, fullName: user.fullName },
      appliedFilters: filter,
      period: { start: toDateOnly(period.start), end: toDateOnly(new Date(period.end.getTime() - 1)) },
    };

    switch (reportKey) {
      case "RPT-01":
        return { reportKey, ...envelope, ...(await this.buildConsolidatedCashPosition(unitIds, period, filter)) };
      case "RPT-02":
        return { reportKey, ...envelope, ...(await this.buildUnitLedger(unitIds, period)) };
      case "RPT-03":
        return { reportKey, ...envelope, ...(await this.buildMonthlyExpenseStatement(unitIds, period, filter)) };
      case "RPT-04":
        return { reportKey, ...envelope, ...(await this.buildCategoryAnalysis(unitIds, period, filter)) };
      case "RPT-05":
        return { reportKey, ...envelope, ...(await this.buildVendorAnalysis(unitIds, period, filter)) };
      case "RPT-06":
        return { reportKey, ...envelope, ...(await this.buildReceiptControl(unitIds, period, filter)) };
      case "RPT-07":
        return { reportKey, ...envelope, ...(await this.buildNegativeBalance(unitIds, period)) };
      case "RPT-08":
        return { reportKey, ...envelope, ...(await this.buildAllocationReplenishment(unitIds, period)) };
      case "RPT-09":
        return { reportKey, ...envelope, ...(await this.buildThreeMonthCompliance(unitIds, period)) };
      case "RPT-10":
        return { reportKey, ...envelope, ...(await this.buildCashCountVariance(unitIds, period)) };
      case "RPT-11":
        return { reportKey, ...envelope, ...(await this.buildBackdatedAndDuplicates(unitIds, period)) };
      case "RPT-12":
        return { reportKey, ...envelope, ...(await this.buildAttachmentIndex(unitIds, period)) };
      case "RPT-13":
        return { reportKey, ...envelope, ...(await this.buildUserActivity(unitIds, period)) };
      case "RPT-14":
        return { reportKey, ...envelope, ...(await this.buildAuditTrail(unitIds, period, filter, auditCursor)) };
      case "RPT-15":
        return { reportKey, ...envelope, ...(await this.buildCrossUnitComparison(unitIds, period)) };
      case "RPT-16":
        return { reportKey, ...envelope, ...(await this.buildLineItemAnalysis(unitIds, period, filter)) };
      default:
        throw new NotImplementedException(`Report ${reportKey} is not yet implemented`);
    }
  }

  // Only unit and date-range filter this report — it's a whole-account rollup with no
  // per-line/per-voucher grain, so category/vendor/amount/receipt/attachmentStatus in
  // ReportFilter are accepted (schema-valid) but have no target column here; that's
  // documented on Rpt01ResponseSchema itself, not silently dropped. negativeBalanceOnly
  // is the one filter meaningful at this grain — it's applied after the rollup, since
  // "negative" is a property of the computed row, not a column to query on.
  private async buildConsolidatedCashPosition(
    unitIds: string[] | null,
    period: ReportPeriod,
    filter: ReportFilter,
  ): Promise<{ rows: Rpt01Row[]; totals: Omit<Rpt01Row, "unitId" | "unitCode" | "unitName"> }> {
    const accounts = await this.reportsRepository.findAccountsWithUnits(unitIds);
    const accountIds = accounts.map((account) => account.id);

    const [openingMap, closingMap, rangeMap] = await Promise.all([
      this.reportsRepository.sumSignedBefore(accountIds, period.start),
      this.reportsRepository.sumSignedBefore(accountIds, period.end),
      this.reportsRepository.sumSignedByTypeInRange(accountIds, period),
    ]);

    let rows: Rpt01Row[] = accounts.map((account) => {
      const openingBalance = openingMap.get(account.id) ?? new Prisma.Decimal(0);
      const expectedBalance = closingMap.get(account.id) ?? new Prisma.Decimal(0);
      const amounts = computeConsolidatedCashAmounts(openingBalance, expectedBalance, rangeMap.get(account.id));
      return {
        unitId: account.unit.id,
        unitCode: account.unit.code,
        unitName: account.unit.name,
        openingBalance: amounts.openingBalance.toFixed(2),
        allocations: amounts.allocations.toFixed(2),
        replenishments: amounts.replenishments.toFixed(2),
        expenditure: amounts.expenditure.toFixed(2),
        adjustments: amounts.adjustments.toFixed(2),
        expectedBalance: amounts.expectedBalance.toFixed(2),
      };
    });

    if (filter.negativeBalanceOnly) {
      rows = rows.filter((row) => new Prisma.Decimal(row.expectedBalance).isNegative());
    }

    const sumField = (field: keyof Rpt01Row) =>
      rows.reduce((sum, row) => sum.plus(new Prisma.Decimal(row[field])), new Prisma.Decimal(0)).toFixed(2);

    return {
      rows,
      totals: {
        openingBalance: sumField("openingBalance"),
        allocations: sumField("allocations"),
        replenishments: sumField("replenishments"),
        expenditure: sumField("expenditure"),
        adjustments: sumField("adjustments"),
        expectedBalance: sumField("expectedBalance"),
      },
    };
  }

  private async buildMonthlyExpenseStatement(unitIds: string[] | null, period: ReportPeriod, filter: ReportFilter) {
    const lines = await this.reportsRepository.listExpenseLines(unitIds, period, filter);
    const voucherIds = new Set<string>();
    let totalAmount = new Prisma.Decimal(0);

    const rows = lines.map((line) => {
      voucherIds.add(line.voucherId);
      totalAmount = totalAmount.plus(line.amount);
      return {
        voucherId: line.voucherId,
        voucherNo: line.voucher.voucherNo,
        unitCode: line.voucher.account.unit.code,
        expenseDate: toDateOnly(line.voucher.expenseDate),
        vendorName: line.voucher.vendorName,
        lineNo: line.lineNo,
        lineDescription: line.description,
        category: line.category,
        lineAmount: line.amount.toFixed(2),
        billTotal: line.voucher.billTotal.toFixed(2),
        checked: line.voucher.checkedAt !== null,
        hasBill: line.voucher.hasBill,
        isBackdated: line.voucher.isBackdated,
      };
    });

    return {
      rows,
      summary: {
        voucherCount: voucherIds.size,
        lineCount: rows.length,
        totalAmount: totalAmount.toFixed(2),
      },
    };
  }

  // filter.category is deliberately ignored here — RPT-04 *is* the category breakdown,
  // so restricting it to one category would defeat the report's own purpose.
  private async buildCategoryAnalysis(unitIds: string[] | null, period: ReportPeriod, filter: ReportFilter) {
    const lines = await this.reportsRepository.listExpenseLines(unitIds, period, { ...filter, category: undefined });

    const categoryTotals = new Map<string, { amount: Prisma.Decimal; count: number }>();
    const trendTotals = new Map<string, Prisma.Decimal>(); // key: `${year}-${month}-${category}`
    let grandTotal = new Prisma.Decimal(0);

    for (const line of lines) {
      const bucket = categoryTotals.get(line.category) ?? { amount: new Prisma.Decimal(0), count: 0 };
      bucket.amount = bucket.amount.plus(line.amount);
      bucket.count += 1;
      categoryTotals.set(line.category, bucket);
      grandTotal = grandTotal.plus(line.amount);

      const expenseDate = line.voucher.expenseDate;
      const trendKey = `${expenseDate.getUTCFullYear()}-${expenseDate.getUTCMonth() + 1}-${line.category}`;
      trendTotals.set(trendKey, (trendTotals.get(trendKey) ?? new Prisma.Decimal(0)).plus(line.amount));
    }

    const rows: Rpt04CategoryRow[] = (["BUILDING", "VEHICLE", "OTHER"] as const).map((category) => {
      const bucket = categoryTotals.get(category) ?? { amount: new Prisma.Decimal(0), count: 0 };
      return {
        category,
        totalAmount: bucket.amount.toFixed(2),
        lineCount: bucket.count,
        percentageOfTotal: computeCategoryPercentage(bucket.amount, grandTotal),
      };
    });

    const trend = Array.from(trendTotals.entries())
      .map(([key, amount]) => {
        const [year, month, category] = key.split("-") as [string, string, "BUILDING" | "VEHICLE" | "OTHER"];
        return { year: Number(year), month: Number(month), category, totalAmount: amount.toFixed(2) };
      })
      .sort((a, b) => a.year - b.year || a.month - b.month || a.category.localeCompare(b.category));

    return { rows, trend, totalAmount: grandTotal.toFixed(2) };
  }

  private async buildReceiptControl(unitIds: string[] | null, period: ReportPeriod, filter: ReportFilter) {
    const vouchers = await this.reportsRepository.listVouchersForReceiptControl(unitIds, period, filter);
    const now = new Date();

    let checkedCount = 0;
    let missingBillCount = 0;
    let ageSum = 0;
    let ageCount = 0;

    const rows = vouchers.map((voucher) => {
      const checked = voucher.checkedAt !== null;
      if (checked) checkedCount += 1;
      if (!voucher.hasBill) missingBillCount += 1;
      const checkAgeDays = computeCheckAgeDays(voucher.enteredAt, voucher.checkedAt, now);
      ageSum += checkAgeDays;
      ageCount += 1;

      return {
        voucherId: voucher.id,
        voucherNo: voucher.voucherNo,
        unitCode: voucher.account.unit.code,
        vendorName: voucher.vendorName,
        expenseDate: toDateOnly(voucher.expenseDate),
        billTotal: voucher.billTotal.toFixed(2),
        checked,
        checkedAt: voucher.checkedAt ? voucher.checkedAt.toISOString() : null,
        hasBill: voucher.hasBill,
        checkAgeDays,
      };
    });

    return {
      rows,
      summary: {
        totalVouchers: rows.length,
        checkedCount,
        uncheckedCount: rows.length - checkedCount,
        missingBillCount,
        avgCheckAgeDays: ageCount > 0 ? Math.round((ageSum / ageCount) * 100) / 100 : null,
      },
    };
  }

  private async buildUnitLedger(unitIds: string[] | null, period: ReportPeriod): Promise<{ rows: Rpt02Row[] }> {
    const entries = await this.reportsRepository.listLedgerEntriesInRange(unitIds, period);
    const rows: Rpt02Row[] = entries.map((entry) => ({
      entryId: entry.id,
      unitCode: entry.account.unit.code,
      entryType: entry.entryType,
      direction: entry.direction,
      amount: entry.amount.toFixed(2),
      effectiveDate: toDateOnly(entry.effectiveDate),
      balanceAfter: entry.balanceAfter.toFixed(2),
      sourceTable: entry.sourceTable,
      sourceId: entry.sourceId,
    }));
    return { rows };
  }

  private async buildVendorAnalysis(
    unitIds: string[] | null,
    period: ReportPeriod,
    filter: ReportFilter,
  ): Promise<{ rows: Rpt05Row[]; totalAmount: string }> {
    const grouped = await this.reportsRepository.groupVouchersByVendor(unitIds, period, filter);
    let grandTotal = new Prisma.Decimal(0);

    const rows: Rpt05Row[] = grouped
      .map((group) => {
        const total = group._sum.billTotal ?? new Prisma.Decimal(0);
        grandTotal = grandTotal.plus(total);
        return {
          vendorName: group.vendorName,
          totalAmount: total.toFixed(2),
          voucherCount: group._count,
          avgAmount: (group._count > 0 ? total.dividedBy(group._count) : new Prisma.Decimal(0)).toFixed(2),
          lastExpenseDate: toDateOnly(group._max.expenseDate ?? period.start),
        };
      })
      .sort((a, b) => new Prisma.Decimal(b.totalAmount).minus(a.totalAmount).toNumber());

    return { rows, totalAmount: grandTotal.toFixed(2) };
  }

  // Streak detection needs each account's FULL ledger history (a streak can start
  // before any date-range filter), so the period only decides which already-detected
  // streaks are shown — one that overlaps [period.start, period.end) at all.
  private async buildNegativeBalance(unitIds: string[] | null, period: ReportPeriod): Promise<{ rows: Rpt07Row[] }> {
    const accounts = await this.reportsRepository.findAccountsWithUnits(unitIds);
    const accountIds = accounts.map((account) => account.id);
    const unitCodeByAccount = new Map(accounts.map((account) => [account.id, account.unit.code]));
    const allEntries = await this.reportsRepository.listAllLedgerEntriesChronological(accountIds);
    const now = new Date();

    const entriesByAccount = new Map<string, typeof allEntries>();
    for (const entry of allEntries) {
      const list = entriesByAccount.get(entry.accountId) ?? [];
      list.push(entry);
      entriesByAccount.set(entry.accountId, list);
    }

    const allStreaks: Array<{ accountId: string; startDate: Date; endDate: Date | null; durationDays: number; lowestBalance: Prisma.Decimal; triggerSourceTable: string | null; triggerSourceId: string | null }> = [];
    for (const [accountId, entries] of entriesByAccount) {
      const points = computeEffectiveBalancePoints(
        entries.map((entry) => ({
          effectiveDate: entry.effectiveDate,
          direction: entry.direction,
          amount: entry.amount,
          sourceTable: entry.sourceTable,
          sourceId: entry.sourceId,
        })),
      );
      for (const streak of computeNegativeBalanceStreaks(points, now)) {
        allStreaks.push({ accountId, ...streak });
      }
    }

    const overlapping = allStreaks.filter(
      (streak) => streak.startDate < period.end && (streak.endDate === null || streak.endDate >= period.start),
    );

    const voucherIds = overlapping
      .filter((streak) => streak.triggerSourceTable === "expense_vouchers" && streak.triggerSourceId)
      .map((streak) => streak.triggerSourceId as string);
    const voucherNoById = await this.reportsRepository.findVoucherNosByIds(voucherIds);

    const rows: Rpt07Row[] = overlapping
      .map((streak) => ({
        unitCode: unitCodeByAccount.get(streak.accountId) ?? "",
        startDate: toDateOnly(streak.startDate),
        endDate: streak.endDate ? toDateOnly(streak.endDate) : null,
        durationDays: streak.durationDays,
        lowestBalance: streak.lowestBalance.toFixed(2),
        triggerVoucherNo: streak.triggerSourceId ? (voucherNoById.get(streak.triggerSourceId) ?? null) : null,
      }))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    return { rows };
  }

  // "Held and exception history" (three-month hold overrides) is deferred — no override
  // log exists outside audit_logs yet; see Rpt08ResponseSchema's own comment.
  private async buildAllocationReplenishment(
    unitIds: string[] | null,
    period: ReportPeriod,
  ): Promise<{ rows: Rpt08Row[]; summary: { totalIssued: string; totalConfirmed: string; pendingCount: number } }> {
    const allocations = await this.reportsRepository.listAllocations(unitIds, period);
    let totalIssued = new Prisma.Decimal(0);
    let totalConfirmed = new Prisma.Decimal(0);
    let pendingCount = 0;

    const rows: Rpt08Row[] = allocations.map((allocation) => {
      totalIssued = totalIssued.plus(allocation.amount);
      const confirmed = allocation.confirmedAt !== null;
      if (confirmed) {
        totalConfirmed = totalConfirmed.plus(allocation.confirmedAmount ?? new Prisma.Decimal(0));
      } else {
        pendingCount += 1;
      }
      return {
        unitCode: allocation.account.unit.code,
        issueDate: toDateOnly(allocation.issueDate),
        amount: allocation.amount.toFixed(2),
        referenceNo: allocation.referenceNo,
        paymentMode: allocation.paymentMode,
        status: confirmed ? "CONFIRMED" : "PENDING_CONFIRMATION",
        confirmedAmount: allocation.confirmedAmount ? allocation.confirmedAmount.toFixed(2) : null,
        confirmedDate: allocation.confirmedDate ? toDateOnly(allocation.confirmedDate) : null,
        confirmedByName: allocation.confirmer?.fullName ?? null,
      };
    });

    return {
      rows,
      summary: { totalIssued: totalIssued.toFixed(2), totalConfirmed: totalConfirmed.toFixed(2), pendingCount },
    };
  }

  private async buildBackdatedAndDuplicates(
    unitIds: string[] | null,
    period: ReportPeriod,
  ): Promise<{ rows: Rpt11Row[]; summary: { backdatedCount: number; duplicateGroupCount: number } }> {
    const [backdated, duplicateGroups] = await Promise.all([
      this.reportsRepository.listBackdatedVouchers(unitIds, period),
      this.reportsRepository.listDuplicateVoucherGroups(unitIds, period),
    ]);

    const rows: Rpt11Row[] = [];
    for (const voucher of backdated) {
      rows.push({
        warningType: "BACKDATED",
        voucherId: voucher.id,
        voucherNo: voucher.voucherNo,
        unitCode: voucher.account.unit.code,
        vendorName: voucher.vendorName,
        expenseDate: toDateOnly(voucher.expenseDate),
        billTotal: voucher.billTotal.toFixed(2),
        detail: "Entered after the working-day backdating threshold (BR-013's entry-lag rule)",
      });
    }
    for (const group of duplicateGroups) {
      for (const voucher of group) {
        rows.push({
          warningType: "DUPLICATE",
          voucherId: voucher.id,
          voucherNo: voucher.voucherNo,
          unitCode: voucher.account.unit.code,
          vendorName: voucher.vendorName,
          expenseDate: toDateOnly(voucher.expenseDate),
          billTotal: voucher.billTotal.toFixed(2),
          detail: `${group.length} vouchers share this vendor, date and amount`,
        });
      }
    }

    return { rows, summary: { backdatedCount: backdated.length, duplicateGroupCount: duplicateGroups.length } };
  }

  private async buildAttachmentIndex(unitIds: string[] | null, period: ReportPeriod): Promise<{ rows: Rpt12Row[] }> {
    const attachments = await this.reportsRepository.listAttachmentsForIndex(unitIds, period);
    const rows: Rpt12Row[] = attachments.map((attachment) => ({
      attachmentId: attachment.id,
      voucherNo: attachment.voucher.voucherNo,
      unitCode: attachment.voucher.account.unit.code,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      uploadedAt: attachment.uploadedAt.toISOString(),
      uploadedByName: attachment.uploader.fullName,
      status: attachment.deletedAt ? "DELETED" : "ACTIVE",
      archiveStatus: attachment.archiveId ? "ARCHIVED" : "NOT_ARCHIVED",
    }));
    return { rows };
  }

  private async buildUserActivity(unitIds: string[] | null, period: ReportPeriod): Promise<{ rows: Rpt13Row[] }> {
    const [entryCounts, checkCounts, editCounts, exportCounts] = await Promise.all([
      this.reportsRepository.countVoucherEntriesByUser(unitIds, period),
      this.reportsRepository.countVoucherChecksByUser(unitIds, period),
      this.reportsRepository.countAuditActionsByActor("EXPENSE_EDIT", period),
      this.reportsRepository.countExportsByUser(period),
    ]);

    const userIds = new Set([...entryCounts.keys(), ...checkCounts.keys(), ...editCounts.keys(), ...exportCounts.keys()]);
    const users = await this.reportsRepository.findUsersByIds(Array.from(userIds));
    const nameById = new Map(users.map((user) => [user.id, user.fullName]));

    const rows: Rpt13Row[] = Array.from(userIds)
      .map((userId) => ({
        userId,
        userName: nameById.get(userId) ?? "Unknown user",
        entriesCount: entryCounts.get(userId) ?? 0,
        checksCount: checkCounts.get(userId) ?? 0,
        editsCount: editCounts.get(userId) ?? 0,
        exportsCount: exportCounts.get(userId) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.entriesCount + b.checksCount + b.editsCount + b.exportsCount -
          (a.entriesCount + a.checksCount + a.editsCount + a.exportsCount),
      );

    return { rows };
  }

  private async buildAuditTrail(
    unitIds: string[] | null,
    period: ReportPeriod,
    filter: ReportFilter,
    cursor?: { occurredAt: Date; id: string },
  ): Promise<{ rows: Rpt14Row[]; nextCursor: { occurredAt: string; id: string } | null }> {
    // actorSearch matches by resolved user name, not a stored column — an empty match
    // set must still filter to zero rows (actorIds: []), not fall through to "no filter".
    const actorIds = filter.actorSearch
      ? await this.reportsRepository.findUserIdsByNameSearch(filter.actorSearch)
      : undefined;

    const limit = 50;
    const logs = await this.reportsRepository.listAuditLogs(
      unitIds,
      period,
      { action: filter.action, entityType: filter.entityType, actorIds },
      cursor,
      limit,
    );

    const actorIdsInLogs = Array.from(new Set(logs.map((log) => log.actorId).filter((id): id is string => id !== null)));
    const unitIdsInLogs = Array.from(new Set(logs.map((log) => log.unitId).filter((id): id is string => id !== null)));
    const [users, unitCodes] = await Promise.all([
      this.reportsRepository.findUsersByIds(actorIdsInLogs),
      this.reportsRepository.findUnitCodesByIds(unitIdsInLogs),
    ]);
    const nameById = new Map(users.map((user) => [user.id, user.fullName]));

    const rows: Rpt14Row[] = logs.map((log) => ({
      id: log.id,
      occurredAt: log.occurredAt.toISOString(),
      actorName: log.actorId ? (nameById.get(log.actorId) ?? null) : null,
      actorRole: log.actorRole,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      unitCode: log.unitId ? (unitCodes.get(log.unitId) ?? null) : null,
      reason: log.reason,
    }));

    const last = logs.at(-1);
    const nextCursor = logs.length === limit && last ? { occurredAt: last.occurredAt.toISOString(), id: last.id } : null;

    return { rows, nextCursor };
  }

  // Reuses RPT-01's own rollup rather than re-querying — the "compliance" ranking
  // dimension is omitted (Rpt15ResponseSchema's own comment: no monthly_closings data
  // exists yet to rank units by, deferred alongside RPT-09/10 per ADR-0003).
  private async buildCrossUnitComparison(unitIds: string[] | null, period: ReportPeriod): Promise<{ rows: Rpt15Row[] }> {
    const { rows: cashRows } = await this.buildConsolidatedCashPosition(unitIds, period, {});
    const rows: Rpt15Row[] = [...cashRows]
      .sort((a, b) => new Prisma.Decimal(b.expenditure).minus(a.expenditure).toNumber())
      .map((row, index) => ({
        rank: index + 1,
        unitCode: row.unitCode,
        unitName: row.unitName,
        expenditure: row.expenditure,
        expectedBalance: row.expectedBalance,
      }));
    return { rows };
  }

  private async buildLineItemAnalysis(
    unitIds: string[] | null,
    period: ReportPeriod,
    filter: ReportFilter,
  ): Promise<{ rows: Rpt16Row[]; totalAmount: string }> {
    const lines = await this.reportsRepository.listExpenseLines(unitIds, period, filter);
    const groups = new Map<string, { category: Rpt16Row["category"]; amount: Prisma.Decimal; count: number }>();
    let grandTotal = new Prisma.Decimal(0);

    for (const line of lines) {
      const key = `${line.description}|${line.category}`;
      const bucket = groups.get(key) ?? { category: line.category, amount: new Prisma.Decimal(0), count: 0 };
      bucket.amount = bucket.amount.plus(line.amount);
      bucket.count += 1;
      groups.set(key, bucket);
      grandTotal = grandTotal.plus(line.amount);
    }

    const rows: Rpt16Row[] = Array.from(groups.entries())
      .map(([key, bucket]) => ({
        description: key.slice(0, key.lastIndexOf("|")),
        category: bucket.category,
        totalAmount: bucket.amount.toFixed(2),
        occurrenceCount: bucket.count,
      }))
      .sort((a, b) => new Prisma.Decimal(b.totalAmount).minus(a.totalAmount).toNumber());

    return { rows, totalAmount: grandTotal.toFixed(2) };
  }

  // Phase 7, deferred from Phase 6 per ADR-0003 — target month is the filtered period's
  // start (defaults to the current Asia/Karachi month, same as every other report),
  // evaluated against the 3 months immediately preceding it (BR-013).
  private async buildThreeMonthCompliance(
    unitIds: string[] | null,
    period: ReportPeriod,
  ): Promise<{ rows: Rpt09Row[]; summary: { eligibleCount: number; heldCount: number } }> {
    const accounts = await this.reportsRepository.findAccountsWithUnits(unitIds);
    const targetYear = period.start.getUTCFullYear();
    const targetMonth = period.start.getUTCMonth() + 1;
    const requiredPeriods = precedingThreeMonths(targetYear, targetMonth);
    const statusesByAccount = await this.monthCloseRepository.findStatusesForAccountsAndPeriods(
      accounts.map((account) => account.id),
      requiredPeriods,
    );

    const rows: Rpt09Row[] = accounts.map((account) => {
      const statuses = statusesByAccount.get(account.id) ?? new Map();
      const compliance = evaluateThreeMonthCompliance(targetYear, targetMonth, statuses);
      return {
        unitCode: account.unit.code,
        unitName: account.unit.name,
        isEligibleForReplenishment: compliance.isCompliant,
        requiredMonths: compliance.requiredMonths,
      };
    });

    const eligibleCount = rows.filter((row) => row.isEligibleForReplenishment).length;
    return { rows, summary: { eligibleCount, heldCount: rows.length - eligibleCount } };
  }

  // Phase 7, deferred from Phase 6 per ADR-0003 — one row per unit for the filtered
  // period's target month; a unit with no monthly_closings row yet for that month still
  // gets a row (status OPEN, every other field null), matching Rpt10RowSchema's own
  // documented stance on MISSING-vs-absent.
  private async buildCashCountVariance(
    unitIds: string[] | null,
    period: ReportPeriod,
  ): Promise<{ rows: Rpt10Row[]; summary: { totalVariance: string; closedCount: number; openCount: number } }> {
    const accounts = await this.reportsRepository.findAccountsWithUnits(unitIds);
    const targetYear = period.start.getUTCFullYear();
    const targetMonth = period.start.getUTCMonth() + 1;
    const closings = await this.reportsRepository.findMonthlyClosingsForPeriod(
      accounts.map((account) => account.id),
      targetYear,
      targetMonth,
    );
    const closingByAccount = new Map(closings.map((closing) => [closing.accountId, closing]));

    let totalVariance = new Prisma.Decimal(0);
    let closedCount = 0;
    let openCount = 0;

    const rows: Rpt10Row[] = accounts.map((account) => {
      const closing = closingByAccount.get(account.id);
      if (closing?.variance) {
        totalVariance = totalVariance.plus(closing.variance);
      }
      if (closing?.status === "CLOSED") {
        closedCount += 1;
      } else {
        openCount += 1;
      }
      return {
        unitCode: account.unit.code,
        unitName: account.unit.name,
        periodYear: targetYear,
        periodMonth: targetMonth,
        physicalCashCount: closing?.physicalCashCount ? closing.physicalCashCount.toFixed(2) : null,
        expectedBalance: closing?.expectedBalance ? closing.expectedBalance.toFixed(2) : null,
        variance: closing?.variance ? closing.variance.toFixed(2) : null,
        remarks: closing?.remarks ?? null,
        status: closing?.status ?? "OPEN",
      };
    });

    return { rows, summary: { totalVariance: totalVariance.toFixed(2), closedCount, openCount } };
  }
}
