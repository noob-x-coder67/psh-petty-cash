import { z } from "zod";
import { AdminUserRoleSchema } from "./users.js";

// Read-only view of prisma/seed-data.ts's ROLES/PERMISSIONS/ROLE_PERMISSIONS as they
// actually exist in the database — a live GET, not the seed data module itself
// (apps/web can't import from prisma/, and the seed data could in principle drift from
// what's actually seeded). Editing this matrix live is a deliberately deferred, bigger
// decision (see docs/decisions and the Administration plan) — this phase is read-only.
export const AdminRoleSchema = z.object({
  key: AdminUserRoleSchema,
  name: z.string(),
});
export type AdminRole = z.infer<typeof AdminRoleSchema>;

export const AdminPermissionSchema = z.object({
  key: z.string(),
  description: z.string().nullable(),
  // false for a seeded permission key that no route in the API actually checks —
  // Appendix A grants it, but it gates nothing today. Surfaced here so this screen
  // never implies a control exists before it's actually wired up (see roles.service.ts).
  enforced: z.boolean(),
});
export type AdminPermission = z.infer<typeof AdminPermissionSchema>;

export const RolePermissionGrantSchema = z.object({
  roleKey: AdminUserRoleSchema,
  permissionKey: z.string(),
});
export type RolePermissionGrant = z.infer<typeof RolePermissionGrantSchema>;

export const RolePermissionMatrixSchema = z.object({
  roles: z.array(AdminRoleSchema),
  permissions: z.array(AdminPermissionSchema),
  grants: z.array(RolePermissionGrantSchema),
});
export type RolePermissionMatrix = z.infer<typeof RolePermissionMatrixSchema>;
