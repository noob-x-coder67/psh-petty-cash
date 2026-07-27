import { z } from "zod";

// FR-CHK-002: marking Checked requires no reason.
export const CheckVoucherRequestSchema = z.object({}).optional();
export type CheckVoucherRequest = z.infer<typeof CheckVoucherRequestSchema>;

// FR-DOC-010: reverting to Unchecked requires a mandatory reason.
export const UncheckVoucherRequestSchema = z.object({
  reason: z.string().min(10),
});
export type UncheckVoucherRequest = z.infer<typeof UncheckVoucherRequestSchema>;

// FR-CHK-006: bulk check only after explicit selection and confirmation.
export const BulkCheckRequestSchema = z.object({
  voucherIds: z.array(z.string().uuid()).min(1),
});
export type BulkCheckRequest = z.infer<typeof BulkCheckRequestSchema>;
