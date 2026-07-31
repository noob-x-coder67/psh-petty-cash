import type { ReportKey } from "@psh/contracts";

export interface ExportColumn {
  header: string;
  get: (row: Record<string, unknown>) => string;
}

function yesNo(value: unknown): string {
  return value ? "Yes" : "No";
}

// One column set per report, shared by the CSV/Excel/PDF builders so all three formats
// present identical columns in identical order. Only trend/summary data outside `rows`
// (e.g. RPT-04's monthly trend series) isn't exported — it's chart-only, in-app data;
// see reports.rules.ts's own comment on why trend is a separate array in the first place.
const COLUMNS: Record<string, ExportColumn[]> = {
  "RPT-01": [
    { header: "Unit Code", get: (r) => String(r.unitCode) },
    { header: "Unit Name", get: (r) => String(r.unitName) },
    { header: "Opening Balance", get: (r) => String(r.openingBalance) },
    { header: "Allocations", get: (r) => String(r.allocations) },
    { header: "Replenishments", get: (r) => String(r.replenishments) },
    { header: "Expenditure", get: (r) => String(r.expenditure) },
    { header: "Adjustments", get: (r) => String(r.adjustments) },
    { header: "Expected Balance", get: (r) => String(r.expectedBalance) },
  ],
  "RPT-03": [
    { header: "Date", get: (r) => String(r.expenseDate) },
    { header: "Voucher No.", get: (r) => String(r.voucherNo) },
    { header: "Unit", get: (r) => String(r.unitCode) },
    { header: "Vendor", get: (r) => String(r.vendorName) },
    { header: "Line Description", get: (r) => String(r.lineDescription) },
    { header: "Category", get: (r) => String(r.category) },
    { header: "Line Amount", get: (r) => String(r.lineAmount) },
    { header: "Bill Total", get: (r) => String(r.billTotal) },
    { header: "Checked", get: (r) => yesNo(r.checked) },
    { header: "Has Bill", get: (r) => yesNo(r.hasBill) },
    { header: "Backdated", get: (r) => yesNo(r.isBackdated) },
  ],
  "RPT-04": [
    { header: "Category", get: (r) => String(r.category) },
    { header: "Total Amount", get: (r) => String(r.totalAmount) },
    { header: "Line Count", get: (r) => String(r.lineCount) },
    { header: "% of Total", get: (r) => String(r.percentageOfTotal) },
  ],
  "RPT-06": [
    { header: "Date", get: (r) => String(r.expenseDate) },
    { header: "Voucher No.", get: (r) => String(r.voucherNo) },
    { header: "Unit", get: (r) => String(r.unitCode) },
    { header: "Vendor", get: (r) => String(r.vendorName) },
    { header: "Bill Total", get: (r) => String(r.billTotal) },
    { header: "Checked", get: (r) => yesNo(r.checked) },
    { header: "Checked At", get: (r) => (r.checkedAt ? String(r.checkedAt) : "") },
    { header: "Has Bill", get: (r) => yesNo(r.hasBill) },
    { header: "Check Age (days)", get: (r) => (r.checkAgeDays === null ? "" : String(r.checkAgeDays)) },
  ],
  "RPT-02": [
    { header: "Date", get: (r) => String(r.effectiveDate) },
    { header: "Effective Time", get: (r) => String(r.effectiveTime) },
    { header: "Unit", get: (r) => String(r.unitCode) },
    { header: "Entry Type", get: (r) => String(r.entryType) },
    { header: "Direction", get: (r) => (Number(r.direction) > 0 ? "+" : "-") },
    { header: "Amount", get: (r) => String(r.amount) },
    { header: "Balance After", get: (r) => String(r.balanceAfter) },
    { header: "Source", get: (r) => String(r.sourceTable ?? "") },
  ],
  "RPT-05": [
    { header: "Vendor", get: (r) => String(r.vendorName) },
    { header: "Total Amount", get: (r) => String(r.totalAmount) },
    { header: "Voucher Count", get: (r) => String(r.voucherCount) },
    { header: "Average Amount", get: (r) => String(r.avgAmount) },
    { header: "Last Expense Date", get: (r) => String(r.lastExpenseDate) },
  ],
  "RPT-07": [
    { header: "Unit", get: (r) => String(r.unitCode) },
    { header: "Start Date", get: (r) => String(r.startDate) },
    { header: "End Date", get: (r) => String(r.endDate ?? "Ongoing") },
    { header: "Duration (days)", get: (r) => String(r.durationDays) },
    { header: "Lowest Balance", get: (r) => String(r.lowestBalance) },
    { header: "Triggering Voucher", get: (r) => String(r.triggerVoucherNo ?? "") },
  ],
  "RPT-08": [
    { header: "Unit", get: (r) => String(r.unitCode) },
    { header: "Issue Date", get: (r) => String(r.issueDate) },
    { header: "Amount", get: (r) => String(r.amount) },
    { header: "Reference No.", get: (r) => String(r.referenceNo ?? "") },
    { header: "Payment Mode", get: (r) => String(r.paymentMode ?? "") },
    { header: "Status", get: (r) => String(r.status) },
    { header: "Confirmed Amount", get: (r) => String(r.confirmedAmount ?? "") },
    { header: "Confirmed Date", get: (r) => String(r.confirmedDate ?? "") },
    { header: "Confirmed By", get: (r) => String(r.confirmedByName ?? "") },
  ],
  "RPT-09": [
    { header: "Unit Code", get: (r) => String(r.unitCode) },
    { header: "Unit Name", get: (r) => String(r.unitName) },
    { header: "Eligible for Replenishment", get: (r) => yesNo(r.isEligibleForReplenishment) },
    {
      header: "Required Months (oldest first)",
      get: (r) =>
        (r.requiredMonths as Array<{ year: number; month: number; status: string }>)
          .map((m) => `${m.year}-${String(m.month).padStart(2, "0")}:${m.status}`)
          .join(", "),
    },
  ],
  "RPT-10": [
    { header: "Unit Code", get: (r) => String(r.unitCode) },
    { header: "Unit Name", get: (r) => String(r.unitName) },
    { header: "Period", get: (r) => `${r.periodYear}-${String(r.periodMonth).padStart(2, "0")}` },
    { header: "Physical Cash Count", get: (r) => String(r.physicalCashCount ?? "") },
    { header: "Expected Balance", get: (r) => String(r.expectedBalance ?? "") },
    { header: "Variance", get: (r) => String(r.variance ?? "") },
    { header: "Remarks", get: (r) => String(r.remarks ?? "") },
    { header: "Status", get: (r) => String(r.status) },
  ],
  "RPT-11": [
    { header: "Warning Type", get: (r) => String(r.warningType) },
    { header: "Voucher No.", get: (r) => String(r.voucherNo) },
    { header: "Unit", get: (r) => String(r.unitCode) },
    { header: "Vendor", get: (r) => String(r.vendorName) },
    { header: "Date", get: (r) => String(r.expenseDate) },
    { header: "Bill Total", get: (r) => String(r.billTotal) },
    { header: "Detail", get: (r) => String(r.detail) },
  ],
  "RPT-12": [
    { header: "Voucher No.", get: (r) => String(r.voucherNo) },
    { header: "Unit", get: (r) => String(r.unitCode) },
    { header: "File Name", get: (r) => String(r.fileName) },
    { header: "MIME Type", get: (r) => String(r.mimeType) },
    { header: "Size (bytes)", get: (r) => String(r.sizeBytes) },
    { header: "Uploaded At", get: (r) => String(r.uploadedAt) },
    { header: "Uploaded By", get: (r) => String(r.uploadedByName) },
    { header: "Status", get: (r) => String(r.status) },
    { header: "Archive Status", get: (r) => String(r.archiveStatus) },
  ],
  "RPT-13": [
    { header: "User", get: (r) => String(r.userName) },
    { header: "Entries", get: (r) => String(r.entriesCount) },
    { header: "Checks", get: (r) => String(r.checksCount) },
    { header: "Edits", get: (r) => String(r.editsCount) },
    { header: "Exports", get: (r) => String(r.exportsCount) },
  ],
  "RPT-14": [
    { header: "Occurred At", get: (r) => String(r.occurredAt) },
    { header: "Actor", get: (r) => String(r.actorName ?? "") },
    { header: "Role", get: (r) => String(r.actorRole ?? "") },
    { header: "Action", get: (r) => String(r.action) },
    { header: "Entity Type", get: (r) => String(r.entityType) },
    { header: "Entity ID", get: (r) => String(r.entityId) },
    { header: "Unit", get: (r) => String(r.unitCode ?? "") },
    { header: "Reason", get: (r) => String(r.reason ?? "") },
  ],
  "RPT-15": [
    { header: "Rank", get: (r) => String(r.rank) },
    { header: "Unit Code", get: (r) => String(r.unitCode) },
    { header: "Unit Name", get: (r) => String(r.unitName) },
    { header: "Expenditure", get: (r) => String(r.expenditure) },
    { header: "Expected Balance", get: (r) => String(r.expectedBalance) },
  ],
  "RPT-16": [
    { header: "Description", get: (r) => String(r.description) },
    { header: "Category", get: (r) => String(r.category) },
    { header: "Total Amount", get: (r) => String(r.totalAmount) },
    { header: "Occurrences", get: (r) => String(r.occurrenceCount) },
  ],
};

export function getExportColumns(reportKey: ReportKey): ExportColumn[] {
  const columns = COLUMNS[reportKey];
  if (!columns) {
    throw new Error(`No export columns defined for ${reportKey}`);
  }
  return columns;
}
