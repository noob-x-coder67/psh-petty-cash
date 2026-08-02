import { z } from "zod";
import { AttachmentSchema } from "./attachments.js";
import { ExpenseCategorySchema } from "./categories.js";

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "must be a decimal amount with up to 2 places");

// HTML <input type="date"> emits "" when left blank, not undefined — z.iso.date().optional()
// only ever treats undefined as "not provided", so a genuinely optional date field (bill
// date is optional; BR-005 only requires expenseDate) failed with "Invalid ISO date" the
// moment a real form bound straight to it, blocking every save that left it blank. Built
// from z.string().optional() with only a .refine() (no .transform()) so the schema's input
// and output types stay identical — either one breaks zodResolver's type inference against
// useForm<CreateVoucherRequest> (.preprocess types the input as `unknown`; .transform makes
// the output key required-but-possibly-undefined instead of optional). Consumers already
// treat an empty/falsy billDate as "not provided" downstream (expenses.service.ts).
const optionalIsoDate = z
  .string()
  .optional()
  .refine((value) => !value || z.iso.date().safeParse(value).success, {
    message: "Invalid ISO date",
  });

export const ExpenseLineInputSchema = z.object({
  description: z.string().min(1),
  categoryId: z.string().uuid(),
  amount: decimalString,
  otherExplanation: z.string().optional(),
});
export type ExpenseLineInput = z.infer<typeof ExpenseLineInputSchema>;

export const CreateVoucherRequestSchema = z
  .object({
    unitId: z.string().uuid(),
    expenseDate: z.iso.date(),
    billDate: optionalIsoDate,
    vendorName: z.string().min(1),
    vendorBillNo: z.string().optional(),
    justification: z.string().min(10),
    billTotal: decimalString,
    hasBill: z.boolean(),
    missingBillReason: z.string().optional(),
    lines: z.array(ExpenseLineInputSchema).min(1),
  })
  .superRefine((data, ctx) => {
    if (!data.hasBill && !data.missingBillReason) {
      ctx.addIssue({
        code: "custom",
        message: "missingBillReason is required when hasBill is false",
        path: ["missingBillReason"],
      });
    }

    // BR-007 is metadata-driven now, so it cannot be evaluated by this transport-only
    // schema. ExpensesService resolves each category ID and applies the rule atomically;
    // PostgreSQL's category trigger remains the final backstop.
  });
export type CreateVoucherRequest = z.infer<typeof CreateVoucherRequestSchema>;

// GET /expenses always carries an explicit scope. The aggregate sentinel is never an
// omitted query value: UnitScopeGuard treats a missing unitId as forbidden, and permits
// this literal only on routes that opt into aggregate access server-side.
export const EXPENSE_ALL_UNITS = "all" as const;
export const ExpenseListUnitScopeSchema = z.union([
  z.string().uuid(),
  z.literal(EXPENSE_ALL_UNITS),
]);
export type ExpenseListUnitScope = z.infer<typeof ExpenseListUnitScopeSchema>;

export const ExpenseCategoryFilterSchema = z.string().uuid().optional();
export type ExpenseCategoryFilter = z.infer<typeof ExpenseCategoryFilterSchema>;

// Only non-financial fields are directly editable (BR-020: fix amounts via reversal +
// re-entry, a compensating action, never an in-place edit of a posted total).
export const EditVoucherRequestSchema = z.object({
  reason: z.string().min(10),
  vendorName: z.string().min(1).optional(),
  vendorBillNo: z.string().optional(),
  billDate: optionalIsoDate,
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
  categoryId: z.string().uuid(),
  category: ExpenseCategorySchema,
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

// List-only enrichment. Create/detail payloads keep ExpenseVoucherSchema unchanged;
// register rows need unit identity so an aggregate result is not ambiguous.
export const ExpenseRegisterVoucherSchema = ExpenseVoucherSchema.extend({
  unit: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
  }),
});
export type ExpenseRegisterVoucher = z.infer<typeof ExpenseRegisterVoucherSchema>;

export const CreateVoucherResultSchema = z.object({
  voucher: ExpenseVoucherSchema,
  balanceWarning: z.boolean(),
  duplicateWarning: z.boolean(),
});
export type CreateVoucherResult = z.infer<typeof CreateVoucherResultSchema>;
