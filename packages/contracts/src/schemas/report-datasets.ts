import { z } from "zod";
import { ExpenseCategorySchema } from "./categories.js";
import { ComplianceMonthSchema } from "./replenishments.js";
import { ReportFilterSchema } from "./report-filters.js";

// Every report response shares this envelope (SRS §10.4: generated date/time,
// generated-by user, visible list of applied filters, period covered).
const ReportEnvelopeSchema = z.object({
  generatedAt: z.string(),
  generatedBy: z.object({ id: z.string().uuid(), fullName: z.string() }),
  appliedFilters: ReportFilterSchema,
  period: z.object({ start: z.iso.date(), end: z.iso.date() }),
});

// RPT-01 Consolidated Cash Position — one row per unit, plus a totals row. Only unit
// and date-range filters affect this report: it's a whole-account rollup (opening,
// allocations, expenditure, adjustments, expected balance), so category/vendor/amount/
// receipt filters in ReportFilterSchema have no per-row target here and are accepted but
// ignored (documented, not silently dropped — see reports.repository.ts).
export const Rpt01RowSchema = z.object({
  unitId: z.string().uuid(),
  unitCode: z.string(),
  unitName: z.string(),
  openingBalance: z.string(),
  allocations: z.string(),
  replenishments: z.string(),
  expenditure: z.string(),
  adjustments: z.string(),
  expectedBalance: z.string(),
});
export const Rpt01ResponseSchema = ReportEnvelopeSchema.extend({
  reportKey: z.literal("RPT-01"),
  rows: z.array(Rpt01RowSchema),
  totals: Rpt01RowSchema.omit({ unitId: true, unitCode: true, unitName: true }),
});
export type Rpt01Response = z.infer<typeof Rpt01ResponseSchema>;

// RPT-03 Monthly Expense Statement — one row per voucher line.
export const Rpt03RowSchema = z.object({
  voucherId: z.string().uuid(),
  voucherNo: z.string(),
  unitCode: z.string(),
  expenseDate: z.iso.date(),
  vendorName: z.string(),
  lineNo: z.number().int(),
  lineDescription: z.string(),
  categoryId: z.string().uuid(),
  category: ExpenseCategorySchema,
  lineAmount: z.string(),
  billTotal: z.string(),
  checked: z.boolean(),
  hasBill: z.boolean(),
  isBackdated: z.boolean(),
});
export const Rpt03ResponseSchema = ReportEnvelopeSchema.extend({
  reportKey: z.literal("RPT-03"),
  rows: z.array(Rpt03RowSchema),
  summary: z.object({
    voucherCount: z.number().int(),
    lineCount: z.number().int(),
    totalAmount: z.string(),
  }),
});
export type Rpt03Response = z.infer<typeof Rpt03ResponseSchema>;

// RPT-04 Category Analysis — totals/percentages for the filtered range, plus a monthly
// trend series so "trends" (SRS §10.2's own word for this report) is real, not implied.
export const Rpt04CategoryRowSchema = z.object({
  categoryId: z.string().uuid(),
  category: ExpenseCategorySchema,
  totalAmount: z.string(),
  lineCount: z.number().int(),
  percentageOfTotal: z.number(),
});
export const Rpt04TrendPointSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  categoryId: z.string().uuid(),
  category: ExpenseCategorySchema,
  totalAmount: z.string(),
});
export const Rpt04ResponseSchema = ReportEnvelopeSchema.extend({
  reportKey: z.literal("RPT-04"),
  rows: z.array(Rpt04CategoryRowSchema),
  trend: z.array(Rpt04TrendPointSchema),
  totalAmount: z.string(),
});
export type Rpt04Response = z.infer<typeof Rpt04ResponseSchema>;

// RPT-06 Receipt Control — one row per voucher; checkAgeDays is days between entry and
// check for checked vouchers, or days since entry (still open) for unchecked ones.
export const Rpt06RowSchema = z.object({
  voucherId: z.string().uuid(),
  voucherNo: z.string(),
  unitCode: z.string(),
  vendorName: z.string(),
  expenseDate: z.iso.date(),
  billTotal: z.string(),
  checked: z.boolean(),
  checkedAt: z.string().nullable(),
  hasBill: z.boolean(),
  checkAgeDays: z.number().int().nullable(),
});
export const Rpt06ResponseSchema = ReportEnvelopeSchema.extend({
  reportKey: z.literal("RPT-06"),
  rows: z.array(Rpt06RowSchema),
  summary: z.object({
    totalVouchers: z.number().int(),
    checkedCount: z.number().int(),
    uncheckedCount: z.number().int(),
    missingBillCount: z.number().int(),
    avgCheckAgeDays: z.number().nullable(),
  }),
});
export type Rpt06Response = z.infer<typeof Rpt06ResponseSchema>;

// RPT-02 Unit Ledger — chronological cash ledger with running balance. Only unit and
// date-range filter this report (Appendix D's other columns don't map onto raw ledger
// rows, which carry no vendor/category — those live on the voucher a ledger entry
// might, but doesn't always, point back to).
export const Rpt02RowSchema = z.object({
  entryId: z.string().uuid(),
  unitCode: z.string(),
  entryType: z.string(),
  direction: z.number().int(),
  amount: z.string(),
  effectiveDate: z.iso.date(),
  // Display-only, formatted server-side from createdAt (when the entry was actually
  // recorded) — not a machine-parseable timestamp, and never used for period/month
  // assignment. effectiveDate itself (above) stays a pure date for that purpose;
  // never derive it from this field or from createdAt.
  effectiveTime: z.string(),
  balanceAfter: z.string(),
  sourceTable: z.string().nullable(),
  sourceId: z.string().nullable(),
});
export const Rpt02ResponseSchema = ReportEnvelopeSchema.extend({
  reportKey: z.literal("RPT-02"),
  rows: z.array(Rpt02RowSchema),
});
export type Rpt02Response = z.infer<typeof Rpt02ResponseSchema>;

// RPT-05 Vendor/Payee Analysis — grouped by exact vendor_name at the voucher grain
// (voucher, not line, since vendor is a voucher-level field).
export const Rpt05RowSchema = z.object({
  vendorName: z.string(),
  totalAmount: z.string(),
  voucherCount: z.number().int(),
  avgAmount: z.string(),
  lastExpenseDate: z.iso.date(),
});
export const Rpt05ResponseSchema = ReportEnvelopeSchema.extend({
  reportKey: z.literal("RPT-05"),
  rows: z.array(Rpt05RowSchema),
  totalAmount: z.string(),
});
export type Rpt05Response = z.infer<typeof Rpt05ResponseSchema>;

// RPT-07 Negative Balance — one row per contiguous negative-balance streak
// (reports.rules.ts's computeNegativeBalanceStreaks), not per ledger entry.
export const Rpt07RowSchema = z.object({
  unitCode: z.string(),
  startDate: z.iso.date(),
  endDate: z.iso.date().nullable(),
  durationDays: z.number().int(),
  lowestBalance: z.string(),
  triggerVoucherNo: z.string().nullable(),
});
export const Rpt07ResponseSchema = ReportEnvelopeSchema.extend({
  reportKey: z.literal("RPT-07"),
  rows: z.array(Rpt07RowSchema),
});
export type Rpt07Response = z.infer<typeof Rpt07ResponseSchema>;

// RPT-08 Allocation and Replenishment — cash issued/confirmed history from
// cash_allocations. "Held and exception history" (three-month hold overrides) has no
// backing table yet (compliance.override_three_month_hold has no persisted exception
// log outside audit_logs) — deferred, same as RPT-01's documented partial coverage.
export const Rpt08RowSchema = z.object({
  unitCode: z.string(),
  issueDate: z.iso.date(),
  amount: z.string(),
  referenceNo: z.string().nullable(),
  paymentMode: z.string().nullable(),
  status: z.enum(["PENDING_CONFIRMATION", "CONFIRMED"]),
  confirmedAmount: z.string().nullable(),
  confirmedDate: z.iso.date().nullable(),
  confirmedByName: z.string().nullable(),
});
export const Rpt08ResponseSchema = ReportEnvelopeSchema.extend({
  reportKey: z.literal("RPT-08"),
  rows: z.array(Rpt08RowSchema),
  summary: z.object({
    totalIssued: z.string(),
    totalConfirmed: z.string(),
    pendingCount: z.number().int(),
  }),
});
export type Rpt08Response = z.infer<typeof Rpt08ResponseSchema>;

// RPT-11 Backdated and Duplicate Warnings — "duplicate" reuses the exact definition
// ExpensesRepository.findPossibleDuplicates already establishes: same account, vendor,
// expense date and bill total.
export const Rpt11RowSchema = z.object({
  warningType: z.enum(["BACKDATED", "DUPLICATE"]),
  voucherId: z.string().uuid(),
  voucherNo: z.string(),
  unitCode: z.string(),
  vendorName: z.string(),
  expenseDate: z.iso.date(),
  billTotal: z.string(),
  detail: z.string(),
});
export const Rpt11ResponseSchema = ReportEnvelopeSchema.extend({
  reportKey: z.literal("RPT-11"),
  rows: z.array(Rpt11RowSchema),
  summary: z.object({ backdatedCount: z.number().int(), duplicateGroupCount: z.number().int() }),
});
export type Rpt11Response = z.infer<typeof Rpt11ResponseSchema>;

// RPT-12 Monthly Attachment Index — voucher-to-file index and archive status.
export const Rpt12RowSchema = z.object({
  attachmentId: z.string().uuid(),
  voucherNo: z.string(),
  unitCode: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  uploadedAt: z.string(),
  uploadedByName: z.string(),
  status: z.enum(["ACTIVE", "DELETED"]),
  archiveStatus: z.enum(["NOT_ARCHIVED", "ARCHIVED"]),
});
export const Rpt12ResponseSchema = ReportEnvelopeSchema.extend({
  reportKey: z.literal("RPT-12"),
  rows: z.array(Rpt12RowSchema),
});
export type Rpt12Response = z.infer<typeof Rpt12ResponseSchema>;

// RPT-13 User Activity — entries/checks/edits/exports by user.
export const Rpt13RowSchema = z.object({
  userId: z.string().uuid(),
  userName: z.string(),
  entriesCount: z.number().int(),
  checksCount: z.number().int(),
  editsCount: z.number().int(),
  exportsCount: z.number().int(),
});
export const Rpt13ResponseSchema = ReportEnvelopeSchema.extend({
  reportKey: z.literal("RPT-13"),
  rows: z.array(Rpt13RowSchema),
});
export type Rpt13Response = z.infer<typeof Rpt13ResponseSchema>;

// RPT-14 Audit Trail — reads audit_logs directly; actorName is null when actorId is
// null (system-attributed rows) or when the actor row no longer resolves (audit_logs
// has no FK to users by design, so an actor can vanish and the row must stay legible).
export const Rpt14RowSchema = z.object({
  id: z.string().uuid(),
  occurredAt: z.string(),
  actorName: z.string().nullable(),
  actorRole: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  unitCode: z.string().nullable(),
  reason: z.string().nullable(),
});
export const Rpt14ResponseSchema = ReportEnvelopeSchema.extend({
  reportKey: z.literal("RPT-14"),
  rows: z.array(Rpt14RowSchema),
  // Keyset cursor (occurredAt, id) — audit_logs has no date-range-bounded default the
  // way the other 15 reports do, so it's the one report response that can page.
  nextCursor: z.object({ occurredAt: z.string(), id: z.string().uuid() }).nullable(),
});
export type Rpt14Response = z.infer<typeof Rpt14ResponseSchema>;

// RPT-15 Cross-Unit Comparison — spending/balance ranking only; the "compliance" ranking
// dimension is omitted (deferred to Phase 7 alongside RPT-09/10 — ADR-0003), since there
// is no monthly_closings data yet to rank units by.
export const Rpt15RowSchema = z.object({
  rank: z.number().int(),
  unitCode: z.string(),
  unitName: z.string(),
  expenditure: z.string(),
  expectedBalance: z.string(),
});
export const Rpt15ResponseSchema = ReportEnvelopeSchema.extend({
  reportKey: z.literal("RPT-15"),
  rows: z.array(Rpt15RowSchema),
});
export type Rpt15Response = z.infer<typeof Rpt15ResponseSchema>;

// RPT-16 Line-Item Analysis — grouped by exact (description, category) pair, independent
// of which voucher a line belongs to (distinct from RPT-03's voucher-grain detail and
// RPT-04's category-grain rollup).
export const Rpt16RowSchema = z.object({
  description: z.string(),
  categoryId: z.string().uuid(),
  category: ExpenseCategorySchema,
  totalAmount: z.string(),
  occurrenceCount: z.number().int(),
});
export const Rpt16ResponseSchema = ReportEnvelopeSchema.extend({
  reportKey: z.literal("RPT-16"),
  rows: z.array(Rpt16RowSchema),
  totalAmount: z.string(),
});
export type Rpt16Response = z.infer<typeof Rpt16ResponseSchema>;

// RPT-09 Three-Month Compliance (Phase 7, deferred from Phase 6 per ADR-0003) — one row
// per unit, evaluating fourth-month replenishment eligibility against the 3 months
// immediately preceding the filtered period's target month.
export const Rpt09RowSchema = z.object({
  unitCode: z.string(),
  unitName: z.string(),
  isEligibleForReplenishment: z.boolean(),
  requiredMonths: z.array(ComplianceMonthSchema),
});
export const Rpt09ResponseSchema = ReportEnvelopeSchema.extend({
  reportKey: z.literal("RPT-09"),
  rows: z.array(Rpt09RowSchema),
  summary: z.object({ eligibleCount: z.number().int(), heldCount: z.number().int() }),
});
export type Rpt09Response = z.infer<typeof Rpt09ResponseSchema>;

// RPT-10 Cash Count and Variance (Phase 7, deferred from Phase 6 per ADR-0003) — one row
// per unit for the filtered period's target month; a unit with no monthly_closings row
// for that month yet still gets a row (status "OPEN", every other field null), same
// "MISSING is not silently dropped" stance as RPT-09/the compliance evaluator itself.
export const Rpt10RowSchema = z.object({
  unitCode: z.string(),
  unitName: z.string(),
  periodYear: z.number().int(),
  periodMonth: z.number().int(),
  physicalCashCount: z.string().nullable(),
  expectedBalance: z.string().nullable(),
  variance: z.string().nullable(),
  remarks: z.string().nullable(),
  status: z.enum(["OPEN", "CLOSED"]),
});
export const Rpt10ResponseSchema = ReportEnvelopeSchema.extend({
  reportKey: z.literal("RPT-10"),
  rows: z.array(Rpt10RowSchema),
  summary: z.object({ totalVariance: z.string(), closedCount: z.number().int(), openCount: z.number().int() }),
});
export type Rpt10Response = z.infer<typeof Rpt10ResponseSchema>;

export const ReportDatasetResponseSchema = z.discriminatedUnion("reportKey", [
  Rpt01ResponseSchema,
  Rpt02ResponseSchema,
  Rpt03ResponseSchema,
  Rpt04ResponseSchema,
  Rpt05ResponseSchema,
  Rpt06ResponseSchema,
  Rpt07ResponseSchema,
  Rpt08ResponseSchema,
  Rpt09ResponseSchema,
  Rpt10ResponseSchema,
  Rpt11ResponseSchema,
  Rpt12ResponseSchema,
  Rpt13ResponseSchema,
  Rpt14ResponseSchema,
  Rpt15ResponseSchema,
  Rpt16ResponseSchema,
]);
export type ReportDatasetResponse = z.infer<typeof ReportDatasetResponseSchema>;
