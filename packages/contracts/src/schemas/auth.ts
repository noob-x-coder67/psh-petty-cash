import { z } from "zod";

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// Mirrors apps/api/src/common/types/authenticated-user.ts (GET /me's response) — apps/web
// can't import that type directly (apps/web must not import from apps/api, Build Plan
// §1.3), so the shape is duplicated here as the shared contract instead.
export const UnitScopeSchema = z.object({
  all: z.boolean(),
  unitIds: z.array(z.string().uuid()),
});
export type UnitScope = z.infer<typeof UnitScopeSchema>;

// Login's response `user` field (auth.controller.ts SessionUser) is a smaller shape
// than /me — no roleKeys/permissionKeys/unitScope.
export const SessionUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

export const LoginResponseSchema = z.object({ user: SessionUserSchema });
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const AuthenticatedUserSchema = SessionUserSchema.extend({
  roleKeys: z.array(z.string()),
  permissionKeys: z.array(z.string()),
  unitScope: UnitScopeSchema,
});
export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;
