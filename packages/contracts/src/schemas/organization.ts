import { z } from "zod";

// Mirrors the OrganizationalUnit fields the frontend actually needs from GET /units
// (already unit-scoped server-side per rule 19 — this is a read shape, not a validated
// input, so it deliberately omits audit columns (createdAt/updatedAt) the UI never uses.
export const OrganizationalUnitSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  type: z.enum(["HEAD_OFFICE", "CENTER", "PROJECT", "PROJECT_LOCATION", "SERVICE"]),
  city: z.string().nullable(),
  parentId: z.string().uuid().nullable(),
  pettyCashEnabled: z.boolean(),
  isActive: z.boolean(),
});
export type OrganizationalUnit = z.infer<typeof OrganizationalUnitSchema>;
