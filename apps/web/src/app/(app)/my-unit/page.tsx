import type { AuthenticatedUser, ComplianceResponse, DashboardUnitResponse, OrganizationalUnit } from "@psh/contracts";
import { CenterWorkspace } from "../../../components/dashboard/center-workspace";
import { serverApiFetch } from "../../../lib/server-api-client";

// Build Plan §4.2: unit scope is the ?unit= query param, not a path segment. Defaults to
// the user's first authorized unit (GET /units is already scoped server-side, rule 19) —
// covers both the common single-unit case and any future multi-unit UNIT_USER (every
// demo UNIT_USER is scoped to exactly one unit today, per the dedicated-user-per-project
// setup, but the page itself makes no such assumption).
export default async function MyUnitPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const params = await searchParams;
  const units = await serverApiFetch<OrganizationalUnit[]>("/units");
  const selected = (params.unit ? units.find((unit) => unit.code === params.unit) : units[0]) ?? units[0];

  if (!selected) {
    return (
      <div className="p-6">
        <p className="text-sm text-ink-muted">No petty-cash unit is assigned to your account.</p>
      </div>
    );
  }

  const [data, compliance, user] = await Promise.all([
    serverApiFetch<DashboardUnitResponse>(`/dashboard/unit/${selected.id}`),
    serverApiFetch<ComplianceResponse>(`/compliance/${selected.id}`),
    serverApiFetch<AuthenticatedUser>("/me"),
  ]);
  return (
    <CenterWorkspace
      data={data}
      compliance={compliance}
      canCreateExpense={user.permissionKeys.includes("expense.create")}
    />
  );
}
