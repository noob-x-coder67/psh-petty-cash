import { z } from "zod";
import { ReportFilterSchema } from "./report-filters.js";

// The 16 SRS §10.2 report keys — one per RPT-* dataset. Kept as a literal union (not a
// free string) so an unknown reportKey is a validation error, not a silent 404 later.
export const ReportKeySchema = z.enum([
  "RPT-01", // Consolidated Cash Position
  "RPT-02", // Unit Ledger
  "RPT-03", // Monthly Expense Statement
  "RPT-04", // Category Analysis
  "RPT-05", // Vendor / Payee Analysis
  "RPT-06", // Receipt Control
  "RPT-07", // Negative Balance
  "RPT-08", // Allocation and Replenishment
  "RPT-09", // Three-Month Compliance (deferred to Phase 7 — ADR-0003)
  "RPT-10", // Cash Count and Variance (deferred to Phase 7 — ADR-0003)
  "RPT-11", // Backdated and Duplicate Warnings
  "RPT-12", // Monthly Attachment Index
  "RPT-13", // User Activity
  "RPT-14", // Audit Trail
  "RPT-15", // Cross-Unit Comparison
  "RPT-16", // Line-Item Analysis
]);
export type ReportKey = z.infer<typeof ReportKeySchema>;

export const ReportExportFormatSchema = z.enum(["PDF", "EXCEL", "CSV"]);
export type ReportExportFormatValue = z.infer<typeof ReportExportFormatSchema>;

export const CreateExportRequestSchema = z.object({
  reportKey: ReportKeySchema,
  filters: ReportFilterSchema,
  format: ReportExportFormatSchema,
});
export type CreateExportRequest = z.infer<typeof CreateExportRequestSchema>;

// Build Plan §3.7: the export endpoint is asynchronous-capable from day one, even in
// the demo — { exportId, status } plus a poll endpoint, so the eventual VPS move to a
// real queue (BullMQ/Redis) is a backend-only change, not a client rewrite. fileRef is
// the display filename (e.g. "RPT-01_2026-07-27.pdf"), populated only once READY;
// errorMessage is populated only once FAILED, so a stuck export always has a reason.
export const ExportStatusResponseSchema = z.object({
  exportId: z.string().uuid(),
  status: z.enum(["PENDING", "READY", "FAILED"]),
  rowCount: z.number().int().nullable(),
  fileRef: z.string().nullable(),
  errorMessage: z.string().nullable(),
});
export type ExportStatusResponse = z.infer<typeof ExportStatusResponseSchema>;

export const CreatePresetRequestSchema = z.object({
  reportKey: ReportKeySchema,
  name: z.string().min(1),
  filters: ReportFilterSchema,
});
export type CreatePresetRequest = z.infer<typeof CreatePresetRequestSchema>;

export const ReportPresetSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  reportKey: ReportKeySchema,
  name: z.string(),
  filters: ReportFilterSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ReportPreset = z.infer<typeof ReportPresetSchema>;
