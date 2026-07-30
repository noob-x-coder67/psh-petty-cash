import type { AdminUserRole } from "@psh/contracts";

// Mirrors prisma/seed-data.ts's ROLES `name` field — apps/web can't import from
// prisma/ (Build Plan §1.3's app/api boundary applies equally to the seed script),
// so the display labels are duplicated here, same convention as packages/contracts
// mirroring apps/api's types instead of importing them.
export const ROLE_LABELS: Record<AdminUserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  FINANCE_MANAGER: "Head of Finance / Finance Manager",
  FINANCE_OFFICER: "Finance Officer",
  UNIT_USER: "Center / Project User",
  UNIT_INCHARGE: "Center / Project In-Charge",
  AUDITOR: "Auditor / Read Only",
  SUPPORT: "Developer / Support",
};

export const ROLE_OPTIONS: AdminUserRole[] = [
  "SUPER_ADMIN",
  "FINANCE_MANAGER",
  "FINANCE_OFFICER",
  "UNIT_USER",
  "UNIT_INCHARGE",
  "AUDITOR",
  "SUPPORT",
];
