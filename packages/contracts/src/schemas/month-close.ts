import { z } from "zod";

export const MonthlyClosingStatusSchema = z.enum(["OPEN", "CLOSED"]);
export type MonthlyClosingStatusValue = z.infer<typeof MonthlyClosingStatusSchema>;

// FR-CLS-002: capture physical cash count. periodYear/periodMonth are explicit, not
// inferred from "now" — Finance closes last month, not necessarily the current one.
export const RecordCashCountRequestSchema = z.object({
  unitId: z.string().uuid(),
  periodYear: z.number().int(),
  periodMonth: z.number().int().min(1).max(12),
  physicalCashCount: z.string(),
  remarks: z.string().optional(),
});
export type RecordCashCountRequest = z.infer<typeof RecordCashCountRequestSchema>;

// FR-CLS-007: reopening a closed month requires a reason.
export const ReopenMonthRequestSchema = z.object({
  reason: z.string().min(1),
});
export type ReopenMonthRequest = z.infer<typeof ReopenMonthRequestSchema>;

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
