"use client";

import type { OrganizationalUnit } from "@psh/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@psh/ui";
import { ComplianceTimeline } from "../month-close/compliance-timeline";
import { useCompliance } from "../month-close/use-compliance";
import { ReplenishmentForm } from "./replenishment-form";

// Scoped to what Phase 7 asks for: replenishment recording + compliance visibility.
// Allocation recording has no UI yet either (a pre-existing gap from Phase 2/5, not
// introduced here) — both are exercised via the API/integration tests today.
export function CashFlowWorkspace({ unit, canOverrideHold }: { unit: OrganizationalUnit; canOverrideHold: boolean }) {
  const { data: compliance } = useCompliance(unit.id);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Cash Flow</h1>
        <p className="text-sm text-ink-muted">
          {unit.name} ({unit.code})
        </p>
      </div>

      {compliance ? (
        <Card>
          <CardHeader>
            <CardTitle>Three-Month Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <ComplianceTimeline months={compliance.timeline} />
          </CardContent>
        </Card>
      ) : null}

      <ReplenishmentForm unitId={unit.id} compliance={compliance} canOverrideHold={canOverrideHold} />
    </div>
  );
}
