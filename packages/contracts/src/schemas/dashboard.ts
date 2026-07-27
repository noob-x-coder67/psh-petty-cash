import { z } from "zod";

// GET /dashboard/finance — SRS §12.2 Command Center. Money fields are decimal strings
// (already formatted server-side), consumed by <Money /> on the frontend, never parsed
// back into floats.
export const UnitPulseSchema = z.object({
  unitId: z.string().uuid(),
  unitCode: z.string(),
  unitName: z.string(),
  balance: z.string(),
  uncheckedCount: z.number().int(),
});
export type UnitPulse = z.infer<typeof UnitPulseSchema>;

export const UncheckedQueueItemSchema = z.object({
  voucherId: z.string().uuid(),
  voucherNo: z.string(),
  unitCode: z.string(),
  vendorName: z.string(),
  billTotal: z.string(),
  expenseDate: z.string(),
});
export type UncheckedQueueItem = z.infer<typeof UncheckedQueueItemSchema>;

export const UnitOnHoldSchema = z.object({
  unitId: z.string().uuid(),
  unitCode: z.string(),
  unitName: z.string(),
});
export type UnitOnHold = z.infer<typeof UnitOnHoldSchema>;

export const DashboardFinanceResponseSchema = z.object({
  kpis: z.object({
    cashIssued: z.string(),
    spending: z.string(),
    expectedCash: z.string(),
    uncheckedCount: z.number().int(),
    negativeCount: z.number().int(),
  }),
  units: z.array(UnitPulseSchema),
  uncheckedQueue: z.array(UncheckedQueueItemSchema),
  // FR-REP-003/Phase 7's compliance ribbon: units where a replenishment issued this
  // month would currently be held (BR-013 — any of the 3 preceding months not CLOSED).
  unitsOnHold: z.array(UnitOnHoldSchema),
});
export type DashboardFinanceResponse = z.infer<typeof DashboardFinanceResponseSchema>;

// GET /dashboard/unit/:id — SRS §12.3 Center Workspace.
export const LedgerEntrySummarySchema = z.object({
  id: z.string().uuid(),
  entryType: z.string(),
  direction: z.number().int(),
  amount: z.string(),
  effectiveDate: z.string(),
  balanceAfter: z.string(),
});
export type LedgerEntrySummary = z.infer<typeof LedgerEntrySummarySchema>;

export const DashboardUnitResponseSchema = z.object({
  unit: z.object({ id: z.string().uuid(), code: z.string(), name: z.string() }),
  balance: z.string(),
  approvedFloat: z.string(),
  period: z.object({
    cashReceived: z.string(),
    spent: z.string(),
    expectedCash: z.string(),
  }),
  recentEntries: z.array(LedgerEntrySummarySchema),
});
export type DashboardUnitResponse = z.infer<typeof DashboardUnitResponseSchema>;
