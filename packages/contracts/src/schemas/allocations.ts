import { z } from "zod";

const decimalString = z.string().regex(/^\d+(\.\d{1,2})?$/, "must be a decimal amount with up to 2 places");

export const CreateAllocationRequestSchema = z.object({
  unitId: z.string().uuid(),
  amount: decimalString,
  issueDate: z.iso.date(),
  referenceNo: z.string().optional(),
  paymentMode: z.string().optional(),
  remarks: z.string().optional(),
  idempotencyKey: z.string().min(1),
});
export type CreateAllocationRequest = z.infer<typeof CreateAllocationRequestSchema>;

export const ConfirmAllocationRequestSchema = z.object({
  confirmedAmount: decimalString,
  confirmedDate: z.iso.date(),
});
export type ConfirmAllocationRequest = z.infer<typeof ConfirmAllocationRequestSchema>;

// Mirrors ReplenishmentSchema (replenishments.ts) minus the compliance-specific fields
// (isCompliant/exceptionReason/etc.) — BR-013's three-month hold never applies to
// Allocations, only Replenishments.
export const AllocationSchema = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid(),
  amount: z.string(),
  issueDate: z.iso.date(),
  referenceNo: z.string().nullable(),
  paymentMode: z.string().nullable(),
  remarks: z.string().nullable(),
  confirmedAmount: z.string().nullable(),
  confirmedDate: z.iso.date().nullable(),
  confirmedAt: z.string().nullable(),
});
export type Allocation = z.infer<typeof AllocationSchema>;
