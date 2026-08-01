import type { AuthenticatedUser, OrganizationalUnit } from "@psh/contracts";
import { ExpenseRegister } from "../../../components/expenses/expense-register";
import { serverApiFetch } from "../../../lib/server-api-client";

// Same ?unit= convention as Center Workspace/Record Expense (Build Plan §4.2). An
// absent browser query is the aggregate default only for users carrying the dedicated
// expense.view_all_units permission; the API request itself still sends unitId=all
// explicitly so missing API scope is never interpreted as aggregate access.
export default async function ExpenseRegisterPage({
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
  const canViewAll = user.permissionKeys.includes("expense.view_all_units");
  const selected = params.unit
    ? (pettyCashUnits.find((unit) => unit.code === params.unit) ?? pettyCashUnits[0])
    : canViewAll
      ? null
      : pettyCashUnits[0];

  if (!selected && !canViewAll) {
    return (
      <div className="p-6">
        <p className="text-sm text-ink-muted">No petty-cash unit is assigned to your account.</p>
      </div>
    );
  }

  return <ExpenseRegister unit={selected ?? null} />;
}
