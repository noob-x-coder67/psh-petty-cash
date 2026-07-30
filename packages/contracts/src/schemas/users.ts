import { z } from "zod";

// Mirrors prisma/schema.prisma's RoleKey enum (prisma/seed-data.ts's ROLES) — the seven
// roles are fixed, seeded data (Appendix A), not user-extensible.
export const AdminUserRoleSchema = z.enum([
  "SUPER_ADMIN",
  "FINANCE_MANAGER",
  "FINANCE_OFFICER",
  "UNIT_USER",
  "UNIT_INCHARGE",
  "AUDITOR",
  "SUPPORT",
]);
export type AdminUserRole = z.infer<typeof AdminUserRoleSchema>;

export const AdminUserUnitSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
});
export type AdminUserUnit = z.infer<typeof AdminUserUnitSchema>;

// The system currently only ever assigns one role per user (every DEMO_USERS entry,
// every roleKeys[0]-style read elsewhere) even though user_roles is technically a
// many-to-many join — `roles` stays an array here to mirror the real schema shape
// rather than commit the contract to "exactly one" the DB doesn't actually enforce.
export const AdminUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string(),
  fullName: z.string(),
  isActive: z.boolean(),
  mustChangePassword: z.boolean(),
  lastLoginAt: z.string().nullable(),
  roles: z.array(AdminUserRoleSchema),
  units: z.array(AdminUserUnitSchema),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const CreateUserRequestSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  fullName: z.string().min(1),
  role: AdminUserRoleSchema,
});
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

// The one-time plaintext temporary password — present only in this create response and
// the reset-password response, never persisted, never logged, never returned again.
export const CreateUserResultSchema = z.object({
  user: AdminUserSchema,
  temporaryPassword: z.string(),
});
export type CreateUserResult = z.infer<typeof CreateUserResultSchema>;

export const SetUserStatusRequestSchema = z.object({
  isActive: z.boolean(),
});
export type SetUserStatusRequest = z.infer<typeof SetUserStatusRequestSchema>;

export const ResetPasswordResultSchema = z.object({
  temporaryPassword: z.string(),
});
export type ResetPasswordResult = z.infer<typeof ResetPasswordResultSchema>;

// A user has exactly one active role in practice (see AdminUserSchema's note) — this
// replaces the existing assignment rather than adding to it.
export const AssignRoleRequestSchema = z.object({
  role: AdminUserRoleSchema,
});
export type AssignRoleRequest = z.infer<typeof AssignRoleRequestSchema>;

export const GrantUnitAccessRequestSchema = z.object({
  unitId: z.string().uuid(),
});
export type GrantUnitAccessRequest = z.infer<typeof GrantUnitAccessRequestSchema>;
