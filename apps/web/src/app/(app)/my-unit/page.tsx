import type { DashboardUnitResponse, OrganizationalUnit } from "@psh/contracts";
import { CenterWorkspace } from "../../../components/dashboard/center-workspace";
import { serverApiFetch } from "../../../lib/server-api-client";

// Build Plan §4.2: unit scope is the ?unit= query param, not a path segment. Defaults to
// the user's first authorized unit (GET /units is already scoped server-side, rule 19) —
// covers both the common single-unit case and multi-unit users like user.rehab.
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

  const data = await serverApiFetch<DashboardUnitResponse>(`/dashboard/unit/${selected.id}`);
  return <CenterWorkspace data={data} />;
}
