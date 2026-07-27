import { z } from "zod";

const decimalString = z.string().regex(/^\d+(\.\d{1,2})?$/, "must be a decimal amount with up to 2 places");

export const ExpenseLineInputSchema = z.object({
  description: z.string().min(1),
  category: z.enum(["BUILDING", "VEHICLE", "OTHER"]),
  amount: decimalString,
  otherExplanation: z.string().optional(),
});
export type ExpenseLineInput = z.infer<typeof ExpenseLineInputSchema>;

export const CreateVoucherRequestSchema = z
  .object({
    unitId: z.string().uuid(),
    expenseDate: z.iso.date(),
    billDate: z.iso.date().optional(),
    vendorName: z.string().min(1),
    vendorBillNo: z.string().optional(),
    justification: z.string().min(10),
    billTotal: decimalString,
    hasBill: z.boolean(),
    missingBillReason: z.string().optional(),
    lines: z.array(ExpenseLineInputSchema).min(1),
  })
  .refine((data) => data.hasBill || Boolean(data.missingBillReason), {
    message: "missingBillReason is required when hasBill is false",
    path: ["missingBillReason"],
  })
  .refine(
    (data) =>
      data.lines.every(
        (line) => line.category !== "OTHER" || (line.otherExplanation?.trim().length ?? 0) >= 5,
      ),
    { message: "OTHER category lines require an explanation of at least 5 characters", path: ["lines"] },
  );
export type CreateVoucherRequest = z.infer<typeof CreateVoucherRequestSchema>;

// Only non-financial fields are directly editable (BR-020: fix amounts via reversal +
// re-entry, a compensating action, never an in-place edit of a posted total).
export const EditVoucherRequestSchema = z.object({
  reason: z.string().min(10),
  vendorName: z.string().min(1).optional(),
  vendorBillNo: z.string().optional(),
  billDate: z.iso.date().optional(),
  justification: z.string().min(10).optional(),
  missingBillReason: z.string().optional(),
});
export type EditVoucherRequest = z.infer<typeof EditVoucherRequestSchema>;

export const ReverseVoucherRequestSchema = z.object({
  reason: z.string().min(10),
});
export type ReverseVoucherRequest = z.infer<typeof ReverseVoucherRequestSchema>;
