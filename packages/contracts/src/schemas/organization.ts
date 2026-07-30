import { z } from "zod";

// Mirrors the OrganizationalUnit fields the frontend actually needs from GET /units
// (already unit-scoped server-side per rule 19 — this is a read shape, not a validated
// input, so it deliberately omits audit columns (createdAt/updatedAt) the UI never uses.
export const UnitTypeSchema = z.enum(["HEAD_OFFICE", "CENTER", "PROJECT", "PROJECT_LOCATION", "SERVICE"]);
export type UnitType = z.infer<typeof UnitTypeSchema>;

export const OrganizationalUnitSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  type: UnitTypeSchema,
  city: z.string().nullable(),
  parentId: z.string().uuid().nullable(),
  pettyCashEnabled: z.boolean(),
  isActive: z.boolean(),
});
export type OrganizationalUnit = z.infer<typeof OrganizationalUnitSchema>;

export const CreateUnitRequestSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: UnitTypeSchema,
  city: z.string().optional(),
  pettyCashEnabled: z.boolean(),
});
export type CreateUnitRequest = z.infer<typeof CreateUnitRequestSchema>;

// code is deliberately not editable — Appendix E codes are stable identifiers
// referenced throughout the system (voucher numbers embed it), same reasoning as
// voucherNo itself being immutable once assigned.
export const UpdateUnitRequestSchema = z.object({
  name: z.string().min(1).optional(),
  type: UnitTypeSchema.optional(),
  city: z.string().optional(),
  pettyCashEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUnitRequest = z.infer<typeof UpdateUnitRequestSchema>;
