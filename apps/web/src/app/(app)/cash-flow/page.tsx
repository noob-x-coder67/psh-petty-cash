import type { AuthenticatedUser, OrganizationalUnit } from "@psh/contracts";
import { CashFlowWorkspace } from "../../../components/cash-flow/cash-flow-workspace";
import { serverApiFetch } from "../../../lib/server-api-client";

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const params = await searchParams;
  const [units, user] = await Promise.all([
    serverApiFetch<OrganizationalUnit[]>("/units"),
    serverApiFetch<AuthenticatedUser>("/me"),
  ]);
  const pettyCashUnits = units.filter((unit) => unit.pettyCashEnabled);
  const selected = (params.unit ? pettyCashUnits.find((unit) => unit.code === params.unit) : pettyCashUnits[0]) ?? pettyCashUnits[0];

  if (!selected) {
    return (
      <div className="p-6">
        <p className="text-sm text-ink-muted">No petty-cash unit is assigned to your account.</p>
      </div>
    );
  }

  return (
    <CashFlowWorkspace
      unit={selected}
      canOverrideHold={user.permissionKeys.includes("compliance.override_three_month_hold")}
      canConfirm={user.permissionKeys.includes("allocation.confirm_receipt")}
    />
  );
}
