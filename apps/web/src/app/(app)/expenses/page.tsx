import type { OrganizationalUnit } from "@psh/contracts";
import { ExpenseRegister } from "../../../components/expenses/expense-register";
import { serverApiFetch } from "../../../lib/server-api-client";

// Same ?unit= convention as Center Workspace/Record Expense (Build Plan §4.2). Finance
// roles (unitScope.all) see their first authorized unit by default and can switch via
// the masthead switcher; unit-scoped users just see their own.
export default async function ExpenseRegisterPage({
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

  return <ExpenseRegister unit={selected} />;
}
