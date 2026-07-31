import type { AuthenticatedUser, OrganizationalUnit } from "@psh/contracts";
import { MonthCloseWorkspace } from "../../../components/month-close/month-close-workspace";
import { serverApiFetch } from "../../../lib/server-api-client";

// Same ?unit= convention as Center Workspace/Record Expense (Build Plan §4.2).
export default async function MonthClosePage({
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
    <MonthCloseWorkspace
      unit={selected}
      canClose={user.permissionKeys.includes("month.close")}
      canEnterCashCount={user.permissionKeys.includes("cash_count.enter")}
    />
  );
}
