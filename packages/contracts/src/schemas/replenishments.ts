import { z } from "zod";

// ADR-0009: confirming receipt is a locked, exact-match attestation against the
// original replenished amount, not a variable figure the confirming user enters —
// petty cash is handed over hand-to-hand, so there is no realistic scenario where a
// different amount is silently received. Only the date is client-supplied.
export const ConfirmReplenishmentRequestSchema = z.object({
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
  confirmedVarianceRemarks: z.string().nullable(),
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

// ADR-0010: Replenishment Request -> Approve -> Confirm workflow. The unit submits a
// request (amount + reason only); BR-013 is checked at submission time server-side, not
// client-supplied. Finance then approves (supplying the disbursement details that used
// to be collected at the old direct-create step) or rejects. Confirming receipt still
// happens via the unchanged ConfirmReplenishmentRequestSchema/Replenishment flow above.
export const SubmitReplenishmentRequestSchema = z.object({
  unitId: z.string().uuid(),
  amount: z.string(),
  reason: z.string().min(1),
  idempotencyKey: z.string().uuid(),
});
export type SubmitReplenishmentRequest = z.infer<typeof SubmitReplenishmentRequestSchema>;

// Finance-initiated override path (ADR-0010) — the only way to push a replenishment
// through while the unit is BR-013-held. Creates the request and approves it in the
// same atomic step, mirroring what the old direct-create flow's exception path did.
export const SubmitReplenishmentOverrideSchema = z.object({
  unitId: z.string().uuid(),
  amount: z.string(),
  reason: z.string().min(1),
  exceptionReason: z.string().min(1),
  issueDate: z.iso.date(),
  referenceNo: z.string().optional(),
  paymentMode: z.string().optional(),
  remarks: z.string().optional(),
  idempotencyKey: z.string().uuid(),
});
export type SubmitReplenishmentOverride = z.infer<typeof SubmitReplenishmentOverrideSchema>;

// Fields Finance supplies at the moment of approval — these used to be collected at
// create-time in the old direct-create flow; the amount itself is never editable here,
// it's locked to whatever the unit originally requested.
export const ApproveReplenishmentRequestSchema = z.object({
  issueDate: z.iso.date(),
  referenceNo: z.string().optional(),
  paymentMode: z.string().optional(),
  remarks: z.string().optional(),
});
export type ApproveReplenishmentRequest = z.infer<typeof ApproveReplenishmentRequestSchema>;

export const RejectReplenishmentRequestSchema = z.object({
  rejectionReason: z.string().min(1),
});
export type RejectReplenishmentRequest = z.infer<typeof RejectReplenishmentRequestSchema>;

export const ReplenishmentRequestStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type ReplenishmentRequestStatusValue = z.infer<typeof ReplenishmentRequestStatusSchema>;

export const ReplenishmentRequestSchema = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid(),
  unitCode: z.string(),
  amount: z.string(),
  reason: z.string(),
  status: ReplenishmentRequestStatusSchema,
  requestedByName: z.string(),
  requestedAt: z.string(),
  isCompliant: z.boolean(),
  exceptionReason: z.string().nullable(),
  decidedByName: z.string().nullable(),
  decidedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  replenishmentId: z.string().uuid().nullable(),
});
export type ReplenishmentRequest = z.infer<typeof ReplenishmentRequestSchema>;
