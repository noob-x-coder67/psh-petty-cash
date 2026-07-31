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
  { code: "PSH-CCS", name: "Pakistan Sweet Home Cadet College Sohawa", type: "CENTER", city: "Sohawa", pettyCashEnabled: true },
  { code: "PSH-SUK", name: "Pakistan Sweet Home Sukkur", type: "CENTER", city: "Sukkur", pettyCashEnabled: true },
  { code: "PSH-BHW", name: "Pakistan Sweet Home Bhalwal", type: "CENTER", city: "Bhalwal", pettyCashEnabled: true },
  { code: "PSH-COE", name: "Pakistan Sweet Home Center of Excellence", type: "CENTER", city: "Rehara, Rawalakot, AJK", pettyCashEnabled: true },
  { code: "FTZ-DST-DHQ", name: "Fatima Tuz Zahra Dastarkhawan", type: "PROJECT_LOCATION", city: "DHQ Raja Bazar, Rawalpindi", pettyCashEnabled: true },
  { code: "FTZ-DST-MCR", name: "Fatima Tuz Zahra Dastarkhawan", type: "PROJECT_LOCATION", city: "MCR, Rawalpindi", pettyCashEnabled: true },
  { code: "PSH-REHAB-CHK", name: "Pakistan Sweet Home Rehabilitation Center", type: "PROJECT_LOCATION", city: "Chakri", pettyCashEnabled: true },
  { code: "PSH-REHAB-H9", name: "Pakistan Sweet Home Rehabilitation Center", type: "PROJECT_LOCATION", city: "H-9, Islamabad", pettyCashEnabled: true },
  { code: "SAFAR-AKH", name: "Pakistan Sweet Home Free Burial Service", type: "SERVICE", city: "Rakh Dhamyal", pettyCashEnabled: true },
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
  { key: "replenishment.request", description: "Submit replenishment request" },
  { key: "replenishment.approve", description: "Approve/reject replenishment request" },
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
  // ADR-0008: confirming receipt is exclusively the receiving unit's job. Finance
  // Manager/Super Admin already hold allocation.record — letting them also confirm
  // receipt would let the same actor both send and confirm-receive cash, defeating
  // the point of a confirmation step. Applies identically to replenishment
  // confirmation, which shares this key (replenishments.controller.ts).
  "allocation.confirm_receipt": ["UNIT_USER", "UNIT_INCHARGE"],
  // ADR-0010: the unit's own single assigned user submits a replenishment request
  // (amount + reason only); BR-013's three-month hold blocks submission outright, no
  // bypass reachable here.
  "replenishment.request": ["UNIT_USER", "UNIT_INCHARGE"],
  // ADR-0010: approving/rejecting is a heavier, one-shot financial commitment (it
  // creates the real ledger-eligible Replenishment row) — scoped to the same two roles
  // that already hold compliance.override_three_month_hold, not to allocation.record's
  // wider set. Finance Officer loses the ability to originate a replenishment at all
  // (previously held via allocation.record); flagged in ADR-0010 as a deliberate,
  // reviewable narrowing, not an oversight.
  "replenishment.approve": ["FINANCE_MANAGER", "SUPER_ADMIN"],
  // ADR-0007: Finance Manager/Super Admin close months administratively and no longer
  // enter or review cash counts at all — that stays with the center (and Finance
  // Officer, who can enter on the center's behalf) exclusively.
  "cash_count.enter": ["UNIT_USER", "UNIT_INCHARGE", "FINANCE_OFFICER"],
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
  { email: "user.sohawa@psh.local", username: "user.sohawa", fullName: "Center User - Sohawa", role: "UNIT_USER", unitCodes: ["PSH-CCS"] },
  { email: "user.sukkur@psh.local", username: "user.sukkur", fullName: "Center User - Sukkur", role: "UNIT_USER", unitCodes: ["PSH-SUK"] },
  { email: "user.bhalwal@psh.local", username: "user.bhalwal", fullName: "Center User - Bhalwal", role: "UNIT_USER", unitCodes: ["PSH-BHW"] },
  { email: "user.coe@psh.local", username: "user.coe", fullName: "Center User - Rawalakot (COE)", role: "UNIT_USER", unitCodes: ["PSH-COE"] },
  { email: "user.rehabchakri@psh.local", username: "user.rehabchakri", fullName: "Project User - Chakri", role: "UNIT_USER", unitCodes: ["PSH-REHAB-CHK"] },
  { email: "user.rehabh9@psh.local", username: "user.rehabh9", fullName: "Project User - H-9 Islamabad", role: "UNIT_USER", unitCodes: ["PSH-REHAB-H9"] },
  { email: "user.ftzdhq@psh.local", username: "user.ftzdhq", fullName: "Project User - DHQ Raja Bazar", role: "UNIT_USER", unitCodes: ["FTZ-DST-DHQ"] },
  { email: "user.ftzmcr@psh.local", username: "user.ftzmcr", fullName: "Project User - MCR", role: "UNIT_USER", unitCodes: ["FTZ-DST-MCR"] },
  { email: "user.safar@psh.local", username: "user.safar", fullName: "Service User - Rakh Dhamyal", role: "UNIT_USER", unitCodes: ["SAFAR-AKH"] },
  { email: "auditor@psh.local", username: "auditor", fullName: "Auditor (Read Only)", role: "AUDITOR", unitCodes: [] },
];
