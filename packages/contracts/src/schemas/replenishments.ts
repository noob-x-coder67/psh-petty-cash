import { z } from "zod";

// FR-REP-005/006. exceptionReason is only meaningful (and only checked server-side)
// when the target month's three-month compliance evaluates to non-compliant — see
// replenishments.rules.ts. idempotencyKey mirrors CashAllocation's own replay-safety.
export const CreateReplenishmentRequestSchema = z.object({
  unitId: z.string().uuid(),
  amount: z.string(),
  issueDate: z.iso.date(),
  referenceNo: z.string().optional(),
  paymentMode: z.string().optional(),
  remarks: z.string().optional(),
  idempotencyKey: z.string().uuid(),
  exceptionReason: z.string().optional(),
});
export type CreateReplenishmentRequest = z.infer<typeof CreateReplenishmentRequestSchema>;

export const ConfirmReplenishmentRequestSchema = z.object({
  confirmedAmount: z.string(),
  confirmedDate: z.iso.date(),
});
export type ConfirmReplenishmentRequest = z.infer<typeof ConfirmReplenishmentRequestSchema>;

export const ReplenishmentSchema = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid(),
  amount: z.string(),
  issueDate: z.iso.date(),
  referenceNo: z.string().nullable(),
  paymentMode: z.string().nullable(),
  remarks: z.string().nullable(),
  isCompliant: z.boolean(),
  exceptionReason: z.string().nullable(),
  exceptionByName: z.string().nullable(),
  exceptionAt: z.string().nullable(),
  confirmedAmount: z.string().nullable(),
  confirmedDate: z.iso.date().nullable(),
  confirmedAt: z.string().nullable(),
});
export type Replenishment = z.infer<typeof ReplenishmentSchema>;

// MISSING = no monthly_closings row exists at all for that period (distinct from OPEN,
// which means a row exists but hasn't been closed yet) — both count as non-compliant,
// but the distinction matters for what the UI tells the user to go do.
export const MonthComplianceStatusSchema = z.enum(["CLOSED", "OPEN", "MISSING"]);
export type MonthComplianceStatusValue = z.infer<typeof MonthComplianceStatusSchema>;

export const ComplianceMonthSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  status: MonthComplianceStatusSchema,
});
export type ComplianceMonth = z.infer<typeof ComplianceMonthSchema>;

// FR-CLS-009 (timeline) + FR-REP-002/003 (compliance calc for the next replenishment) in
// one response — the Command Center ribbon only needs nextReplenishment.isCompliant, the
// Month Close screen's timeline needs the full trailing window (long enough to visibly
// cross a year boundary, per Phase 7's exit gate).
export const ComplianceResponseSchema = z.object({
  unitId: z.string().uuid(),
  unitCode: z.string(),
  timeline: z.array(ComplianceMonthSchema),
  nextReplenishment: z.object({
    targetYear: z.number().int(),
    targetMonth: z.number().int(),
    isCompliant: z.boolean(),
    requiredMonths: z.array(ComplianceMonthSchema),
  }),
});
export type ComplianceResponse = z.infer<typeof ComplianceResponseSchema>;
