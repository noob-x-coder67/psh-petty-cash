import { z } from "zod";

export const MonthlyClosingStatusSchema = z.enum(["OPEN", "CLOSED"]);
export type MonthlyClosingStatusValue = z.infer<typeof MonthlyClosingStatusSchema>;

// Denomination-based cash count (not in the original SRS §6.5, a later addition):
// physical_cash_count is derived server-side as Σ(denomination × count) rather than
// typed directly — a typed total is easy to fake independently of what was actually
// counted, defeating the point of a breakdown. The value list itself lives here, not in
// a DB CHECK, so a future SBP note/coin change is a one-place edit, not a migration.
export const CASH_COUNT_DENOMINATIONS = [5000, 1000, 500, 100, 50, 20, 10] as const;

export const CashCountDenominationSchema = z.object({
  denomination: z.number().int().positive(),
  count: z.number().int().min(0),
});
export type CashCountDenomination = z.infer<typeof CashCountDenominationSchema>;

// FR-CLS-002: capture physical cash count. periodYear/periodMonth are explicit, not
// inferred from "now" — Finance closes last month, not necessarily the current one.
export const RecordCashCountRequestSchema = z.object({
  unitId: z.string().uuid(),
  periodYear: z.number().int(),
  periodMonth: z.number().int().min(1).max(12),
  denominations: z.array(CashCountDenominationSchema).superRefine((denominations, ctx) => {
    const seen = new Set<number>();
    for (const { denomination } of denominations) {
      if (!(CASH_COUNT_DENOMINATIONS as readonly number[]).includes(denomination)) {
        ctx.addIssue({ code: "custom", message: `${denomination} is not a recognized denomination` });
      }
      if (seen.has(denomination)) {
        ctx.addIssue({ code: "custom", message: `Denomination ${denomination} was submitted more than once` });
      }
      seen.add(denomination);
    }
    for (const expected of CASH_COUNT_DENOMINATIONS) {
      if (!seen.has(expected)) {
        ctx.addIssue({ code: "custom", message: `Missing a count for denomination ${expected}` });
      }
    }
  }),
  remarks: z.string().optional(),
});
export type RecordCashCountRequest = z.infer<typeof RecordCashCountRequestSchema>;

// FR-CLS-007: reopening a closed month requires a reason.
export const ReopenMonthRequestSchema = z.object({
  reason: z.string().min(1),
});
export type ReopenMonthRequest = z.infer<typeof ReopenMonthRequestSchema>;

// ADR-0007: closing is addressed by unit+period, not a MonthlyClosing row id — a period
// with no cash count ever recorded also has no row yet, and Finance Manager/Super Admin
// must still be able to close it directly.
export const CloseMonthRequestSchema = z.object({
  unitId: z.string().uuid(),
  periodYear: z.number().int(),
  periodMonth: z.number().int().min(1).max(12),
});
export type CloseMonthRequest = z.infer<typeof CloseMonthRequestSchema>;

// FR-CLS-005: entry count, total expenditure, unchecked receipts, missing bills and
// negative-balance events for the period — the same shape RPT-06's summary already
// computes, reused here rather than re-derived.
export const MonthlyClosingSummarySchema = z.object({
  voucherCount: z.number().int(),
  totalExpenditure: z.string(),
  uncheckedCount: z.number().int(),
  missingBillCount: z.number().int(),
  negativeBalanceEvents: z.number().int(),
});
export type MonthlyClosingSummary = z.infer<typeof MonthlyClosingSummarySchema>;

export const MonthlyClosingSchema = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid(),
  unitCode: z.string(),
  periodYear: z.number().int(),
  periodMonth: z.number().int(),
  physicalCashCount: z.string().nullable(),
  // Empty for a legacy/pre-feature closing that only ever had a typed total — the UI
  // branches on this to keep displaying those exactly as before, never synthesizing a
  // fake breakdown for old data.
  denominations: z.array(CashCountDenominationSchema),
  countedByName: z.string().nullable(),
  countedAt: z.string().nullable(),
  expectedBalance: z.string().nullable(),
  variance: z.string().nullable(),
  remarks: z.string().nullable(),
  status: MonthlyClosingStatusSchema,
  closedByName: z.string().nullable(),
  closedAt: z.string().nullable(),
  reopenedByName: z.string().nullable(),
  reopenedAt: z.string().nullable(),
  reopenReason: z.string().nullable(),
  summary: MonthlyClosingSummarySchema,
});
export type MonthlyClosing = z.infer<typeof MonthlyClosingSchema>;
