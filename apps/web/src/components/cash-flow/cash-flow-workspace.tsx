"use client";

import type { OrganizationalUnit } from "@psh/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@psh/ui";
import { ComplianceTimeline } from "../month-close/compliance-timeline";
import { useCompliance } from "../month-close/use-compliance";
import { AllocationForm } from "./allocation-form";
import { PendingConfirmations } from "./pending-confirmations";
import { ReplenishmentForm } from "./replenishment-form";

export function CashFlowWorkspace({
  unit,
  canOverrideHold,
  canConfirm,
}: {
  unit: OrganizationalUnit;
  canOverrideHold: boolean;
  canConfirm: boolean;
}) {
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

      <PendingConfirmations unitId={unit.id} canConfirm={canConfirm} />

      <AllocationForm unitId={unit.id} />

      <ReplenishmentForm unitId={unit.id} compliance={compliance} canOverrideHold={canOverrideHold} />
    </div>
  );
}
