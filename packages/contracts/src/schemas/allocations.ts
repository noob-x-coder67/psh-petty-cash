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
