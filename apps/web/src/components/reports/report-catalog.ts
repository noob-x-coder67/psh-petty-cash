import type { ReportKey } from "@psh/contracts";

export interface ReportCatalogEntry {
  key: ReportKey;
  title: string;
  purpose: string;
  implemented: boolean;
  // Set only when `implemented` is false — which build phase actually adds it, so the
  // gallery never implies a report is coming "soon" with no real commitment behind it.
  availableFrom?: string;
}

// SRS §10.2's 16 required reports, transcribed directly (title/purpose columns) rather
// than re-derived, so this list can be diffed against the SRS table by eye.
export const REPORT_CATALOG: ReportCatalogEntry[] = [
  {
    key: "RPT-01",
    title: "Consolidated Cash Position",
    purpose: "Opening, allocations, expenditure, adjustments, expected balance by unit",
    implemented: true,
  },
  {
    key: "RPT-02",
    title: "Unit Ledger",
    purpose: "Chronological cash ledger with running balance",
    implemented: true,
  },
  {
    key: "RPT-03",
    title: "Monthly Expense Statement",
    purpose: "Voucher and line-item detail for selected month",
    implemented: true,
  },
  {
    key: "RPT-04",
    title: "Category Analysis",
    purpose: "Building, Vehicle and Other totals, percentages and trends",
    implemented: true,
  },
  {
    key: "RPT-05",
    title: "Vendor / Payee Analysis",
    purpose: "Spending by vendor/payee and frequency",
    implemented: true,
  },
  {
    key: "RPT-06",
    title: "Receipt Control",
    purpose: "Checked, Unchecked, missing bill and check-age analysis",
    implemented: true,
  },
  {
    key: "RPT-07",
    title: "Negative Balance",
    purpose: "Units, dates, vouchers and duration of negative balances",
    implemented: true,
  },
  {
    key: "RPT-08",
    title: "Allocation and Replenishment",
    purpose: "Cash issued, confirmed, held and exception history",
    implemented: true,
  },
  {
    key: "RPT-09",
    title: "Three-Month Compliance",
    purpose: "Completion timeline and fourth-month eligibility",
    implemented: true,
  },
  {
    key: "RPT-10",
    title: "Cash Count and Variance",
    purpose: "Expected vs physical cash and remarks",
    implemented: true,
  },
  {
    key: "RPT-11",
    title: "Backdated and Duplicate Warnings",
    purpose: "Late entries and possible duplicate patterns",
    implemented: true,
  },
  {
    key: "RPT-12",
    title: "Monthly Attachment Index",
    purpose: "Voucher-to-file index and archive status",
    implemented: true,
  },
  {
    key: "RPT-13",
    title: "User Activity",
    purpose: "Entries, checks, edits and exports by user",
    implemented: true,
  },
  {
    key: "RPT-14",
    title: "Audit Trail",
    purpose: "Complete immutable action history",
    implemented: true,
  },
  {
    key: "RPT-15",
    title: "Cross-Unit Comparison",
    purpose: "Ranked spending, balance and compliance by unit",
    implemented: true,
  },
  {
    key: "RPT-16",
    title: "Line-Item Analysis",
    purpose: "Item descriptions and category totals independent of voucher header",
    implemented: true,
  },
];

export function findReportCatalogEntry(key: string): ReportCatalogEntry | undefined {
  return REPORT_CATALOG.find((entry) => entry.key === key);
}
