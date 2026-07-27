import { z } from "zod";
import { AttachmentSchema } from "./attachments.js";

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

// Read shapes — mirror ExpenseVoucher/ExpenseLine (prisma/schema.prisma) as serialized
// over JSON (Decimal -> string via decimal.js's toJSON, Date -> ISO string).
export const ExpenseLineSchema = z.object({
  id: z.string().uuid(),
  voucherId: z.string().uuid(),
  lineNo: z.number().int(),
  description: z.string(),
  category: z.enum(["BUILDING", "VEHICLE", "OTHER"]),
  amount: z.string(),
  otherExplanation: z.string().nullable(),
});
export type ExpenseLine = z.infer<typeof ExpenseLineSchema>;

export const ExpenseVoucherSchema = z.object({
  id: z.string().uuid(),
  voucherNo: z.string(),
  accountId: z.string().uuid(),
  expenseDate: z.string(),
  billDate: z.string().nullable(),
  vendorName: z.string(),
  vendorBillNo: z.string().nullable(),
  justification: z.string(),
  billTotal: z.string(),
  linesTotal: z.string(),
  state: z.enum(["ACTIVE", "REVERSED"]),
  hasBill: z.boolean(),
  missingBillReason: z.string().nullable(),
  checkedBy: z.string().uuid().nullable(),
  checkedAt: z.string().nullable(),
  isBackdated: z.boolean(),
  balanceAfter: z.string().nullable(),
  enteredBy: z.string().uuid(),
  enteredAt: z.string(),
  reversedByVoucherId: z.string().uuid().nullable(),
  lines: z.array(ExpenseLineSchema),
  attachments: z.array(AttachmentSchema),
});
export type ExpenseVoucher = z.infer<typeof ExpenseVoucherSchema>;

export const CreateVoucherResultSchema = z.object({
  voucher: ExpenseVoucherSchema,
  balanceWarning: z.boolean(),
  duplicateWarning: z.boolean(),
});
export type CreateVoucherResult = z.infer<typeof CreateVoucherResultSchema>;
