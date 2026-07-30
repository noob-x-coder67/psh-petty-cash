import type { RoleKey, UnitType } from "@prisma/client";

// Appendix E: exactly the 9 petty-cash-enabled units plus PSH-ISB (petty_cash_enabled=false).
// Flat under a single implicit Head Office — Appendix E names no Head Office row and no
// intermediate "project" grouping tier, so none is invented here. Which of these should
// report under a shared grouping node (e.g. Safar-e-Akhrat, the two Dastarkhawan locations)
// is explicitly still an open question per Build Plan §8 item 2 — not decided by this seed.
export const UNITS: Array<{
  code: string;
  name: string;
  type: UnitType;
  city: string | null;
  pettyCashEnabled: boolean;
}> = [
  { code: "PSH-ISB", name: "Pakistan Sweet Home Islamabad", type: "CENTER", city: "Islamabad", pettyCashEnabled: false },
  { code: "PSH-SOH", name: "Pakistan Sweet Home Cadet College Sohawa", type: "CENTER", city: "Sohawa", pettyCashEnabled: true },
  { code: "PSH-SUK", name: "Pakistan Sweet Home Sukkur", type: "CENTER", city: "Sukkur", pettyCashEnabled: true },
  { code: "PSH-BWL", name: "Pakistan Sweet Home Bhalwal", type: "CENTER", city: "Bhalwal", pettyCashEnabled: true },
  { code: "PSH-COE", name: "Pakistan Sweet Home Center of Excellence, Rehara, Rawalakot, AJK", type: "CENTER", city: "Rawalakot", pettyCashEnabled: true },
  { code: "FTZ-RAJA", name: "Fatima Tuz Zahra Dastarkhawan - Raja Bazaar, Rawalpindi", type: "PROJECT_LOCATION", city: "Rawalpindi", pettyCashEnabled: true },
  { code: "FTZ-LQB", name: "Fatima Tuz Zahra Dastarkhawan - Liaquat Bagh, Rawalpindi", type: "PROJECT_LOCATION", city: "Rawalpindi", pettyCashEnabled: true },
  { code: "REHAB-CHK", name: "Pakistan Sweet Home Rehabilitation Center - Chakri, Rawalpindi", type: "PROJECT_LOCATION", city: "Rawalpindi", pettyCashEnabled: true },
  { code: "REHAB-H9", name: "Pakistan Sweet Home Rehabilitation Center - H-9 Islamabad", type: "PROJECT_LOCATION", city: "Islamabad", pettyCashEnabled: true },
  { code: "SAFAR-AKH", name: "Pakistan Sweet Home Free Burial Service (Safar-e-Akhrat)", type: "SERVICE", city: null, pettyCashEnabled: true },
];

export const ROLES: Array<{ key: RoleKey; name: string }> = [
  { key: "SUPER_ADMIN", name: "Super Admin" },
  { key: "FINANCE_MANAGER", name: "Head of Finance / Finance Manager" },
  { key: "FINANCE_OFFICER", name: "Finance Officer" },
  { key: "UNIT_USER", name: "Center / Project User" },
  { key: "UNIT_INCHARGE", name: "Center / Project In-Charge" },
  { key: "AUDITOR", name: "Auditor / Read Only" },
  { key: "SUPPORT", name: "Developer / Support" },
];

export const PERMISSIONS: Array<{ key: string; description: string }> = [
  { key: "dashboard.view_own_unit", description: "View own unit dashboard" },
  { key: "dashboard.view_all", description: "View finance-wide Command Center (cross-unit)" },
  { key: "expense.create", description: "Create expense" },
  { key: "expense.edit_saved", description: "Edit saved expense" },
  { key: "receipt.view", description: "View receipt" },
  { key: "receipt.check", description: "Mark receipt Checked" },
  { key: "attachment.upload", description: "Upload a bill attachment" },
  { key: "allocation.record", description: "Record allocation" },
  { key: "allocation.confirm_receipt", description: "Confirm allocation receipt" },
  { key: "cash_count.enter", description: "Enter physical cash count" },
  { key: "month.close", description: "Close month" },
  { key: "compliance.override_three_month_hold", description: "Override three-month hold" },
  { key: "category.manage", description: "Manage categories" },
  { key: "admin.manage_users_units", description: "Manage users/units" },
  { key: "admin.manage_unit_access", description: "Assign roles and unit access to existing users" },
  { key: "audit.view", description: "View audit" },
  { key: "report.export", description: "Export reports" },
];

// Appendix A, transcribed directly (Yes / Optional / Policy only / Limited / Own / All ->
// granted; No -> not granted). Appendix A has no Auditor or Support column — those two
// mappings are inferred from the role narratives in SRS §6.1, flagged to you as pending
// Finance confirmation, not a final decision:
//   - AUDITOR: read-only (view + export), no writes, no checks, no allocations.
//   - SUPPORT: zero permissions by default (§6.2 — support must not bypass audit controls).
export const ROLE_PERMISSIONS: Record<string, RoleKey[]> = {
  "dashboard.view_own_unit": ["UNIT_USER", "UNIT_INCHARGE", "FINANCE_OFFICER", "FINANCE_MANAGER", "SUPER_ADMIN", "AUDITOR"],
  // Matches ALL_UNIT_SCOPE_ROLES (auth-context.repository.ts) — the Command Center
  // aggregates every unit, so it's gated to the same roles that get unitScope.all.
  "dashboard.view_all": ["FINANCE_OFFICER", "FINANCE_MANAGER", "SUPER_ADMIN", "AUDITOR"],
  "expense.create": ["UNIT_USER", "UNIT_INCHARGE"],
  "expense.edit_saved": ["FINANCE_MANAGER", "SUPER_ADMIN"],
  "receipt.view": ["UNIT_USER", "UNIT_INCHARGE", "FINANCE_OFFICER", "FINANCE_MANAGER", "SUPER_ADMIN", "AUDITOR"],
  "receipt.check": ["FINANCE_OFFICER", "FINANCE_MANAGER", "SUPER_ADMIN"],
  "attachment.upload": ["UNIT_USER", "UNIT_INCHARGE", "FINANCE_OFFICER", "FINANCE_MANAGER", "SUPER_ADMIN"],
  "allocation.record": ["FINANCE_OFFICER", "FINANCE_MANAGER", "SUPER_ADMIN"],
  "allocation.confirm_receipt": ["UNIT_USER", "UNIT_INCHARGE", "FINANCE_MANAGER", "SUPER_ADMIN"],
  "cash_count.enter": ["UNIT_USER", "UNIT_INCHARGE", "FINANCE_OFFICER", "FINANCE_MANAGER", "SUPER_ADMIN"],
  "month.close": ["FINANCE_MANAGER", "SUPER_ADMIN"],
  "compliance.override_three_month_hold": ["FINANCE_MANAGER", "SUPER_ADMIN"],
  "category.manage": ["FINANCE_MANAGER", "SUPER_ADMIN"],
  // Appendix A: "Manage users/units" is Finance Manager: Limited, Super Admin: Yes — split
  // into two keys rather than one shared grant. admin.manage_users_units (user account
  // lifecycle: create/deactivate/reset; unit create/edit) matches FR-AUTH-006 ("Super Admin
  // shall activate, deactivate and reset users") and stays Super-Admin-only.
  // admin.manage_unit_access (assigning roles/unit-access to EXISTING users) is what
  // "Limited" means in practice, and both roles hold it.
  "admin.manage_users_units": ["SUPER_ADMIN"],
  "admin.manage_unit_access": ["FINANCE_MANAGER", "SUPER_ADMIN"],
  "audit.view": ["UNIT_INCHARGE", "FINANCE_OFFICER", "FINANCE_MANAGER", "SUPER_ADMIN", "AUDITOR"],
  "report.export": ["UNIT_USER", "UNIT_INCHARGE", "FINANCE_OFFICER", "FINANCE_MANAGER", "SUPER_ADMIN", "AUDITOR"],
};

// Demo-only credential for every seeded user — this is a local/demo dataset (SRS §18.3:
// "no real financial data... redacted sample bills only"), never a production password.
// Real per-user credentials and a forced password-change flow are an operator task once
// this seed is ever pointed at a non-demo environment (must_change_password exists for it).
export const DEMO_PASSWORD = "Demo-Passw0rd!";

export const DEMO_USERS: Array<{
  email: string;
  username: string;
  fullName: string;
  role: RoleKey;
  unitCodes: string[]; // [] means all-unit scope is derived from role, not enumerated rows
}> = [
  { email: "superadmin@psh.local", username: "superadmin", fullName: "Super Admin", role: "SUPER_ADMIN", unitCodes: [] },
  { email: "financemanager@psh.local", username: "financemanager", fullName: "Finance Manager", role: "FINANCE_MANAGER", unitCodes: [] },
  { email: "financeofficer@psh.local", username: "financeofficer", fullName: "Finance Officer", role: "FINANCE_OFFICER", unitCodes: [] },
  { email: "user.sohawa@psh.local", username: "user.sohawa", fullName: "Center User - Sohawa", role: "UNIT_USER", unitCodes: ["PSH-SOH"] },
  { email: "user.sukkur@psh.local", username: "user.sukkur", fullName: "Center User - Sukkur", role: "UNIT_USER", unitCodes: ["PSH-SUK"] },
  { email: "user.rehab@psh.local", username: "user.rehab", fullName: "Project User - Rehabilitation", role: "UNIT_USER", unitCodes: ["REHAB-CHK", "REHAB-H9"] },
  { email: "auditor@psh.local", username: "auditor", fullName: "Auditor (Read Only)", role: "AUDITOR", unitCodes: [] },
];
