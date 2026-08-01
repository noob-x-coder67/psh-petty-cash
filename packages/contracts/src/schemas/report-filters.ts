import { z } from "zod";

// The shared cross-report filter contract (SRS §10.3), distinct from Phase 5e's
// Expense Register search (apps/api/src/modules/expenses/expenses.repository.ts's own
// comment already draws this line) — that one is single-unit, plain-ILIKE, keyset-
// paginated; this one is cross-unit capable and is what report_exports.filters (jsonb)
// persists, so a saved preset or a generated export always reflects exactly the filter
// set the on-screen preview used.
//
// Two §10.3 dimensions are intentionally NOT modeled here:
//   - "Fiscal quarter and year" — no fiscal year start month is defined anywhere in the
//     SRS/Build Plan; periods are only ever computed as Asia/Karachi calendar months
//     (rule 15). Inventing a fiscal-year convention isn't this contract's call to make.
//   - "Project group" — Build Plan §8 lists which units should share a grouping node as
//     an explicitly still-open question; no taxonomy exists to filter by yet.
// Two more are deferred, not omitted — ADR-0003:
//   - "Monthly close status" / "Three-month compliance status" — both depend on
//     monthly_closings, which doesn't exist until Phase 7.
// "Possible duplicate flag" isn't a stored column (duplicateWarning is computed
// transiently at voucher-creation time, never persisted) — RPT-11 recomputes it with
// its own bespoke self-join query rather than a generic filter flag here.
// attachmentStatus is modeled in the schema but not yet wired into any of RPT-01/03/04/06
// (Phase 6b) — it's an attachment-level filter that belongs to RPT-12 (Monthly Attachment
// Index, Phase 6e), which is the first report that actually joins to the attachments table.
export const ReportFilterSchema = z
  .object({
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
  enteredAtFrom: z.iso.date().optional(),
  enteredAtTo: z.iso.date().optional(),
  unitIds: z.array(z.string().uuid()).optional(),
  // Stable managed-category identity (ADR-0011). Names are editable display metadata
  // and therefore must never be persisted as a filter value.
  categoryId: z.string().uuid().optional(),
  vendorSearch: z.string().optional(),
  amountMin: z.string().optional(),
  amountMax: z.string().optional(),
  checked: z.boolean().optional(),
  hasBill: z.boolean().optional(),
  negativeBalanceOnly: z.boolean().optional(),
  enteredBy: z.string().uuid().optional(),
  checkedBy: z.string().uuid().optional(),
  isBackdated: z.boolean().optional(),
  attachmentStatus: z.enum(["ACTIVE", "DELETED"]).optional(),
  // RPT-14-only — ignored by the other 15 reports, same "accepted but has no target
  // column here" stance already documented on Rpt01ResponseSchema for its own subset.
  actorSearch: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  })
  .strict();
export type ReportFilter = z.infer<typeof ReportFilterSchema>;
