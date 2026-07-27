import type { OrganizationalUnit } from "@psh/contracts";
import { RecordExpenseForm } from "../../../../components/expenses/record-expense-form";
import { serverApiFetch } from "../../../../lib/server-api-client";

// expense.create is only ever granted to UNIT_USER/UNIT_INCHARGE (always unit-scoped,
// never unitScope.all — prisma/seed.ts), so this always resolves to one of the caller's
// own units, same ?unit= convention as Center Workspace (Build Plan §4.2).
export default async function RecordExpensePage({
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

  return <RecordExpenseForm unit={selected} />;
}
