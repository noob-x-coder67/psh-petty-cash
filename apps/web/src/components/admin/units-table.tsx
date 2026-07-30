"use client";

import type { OrganizationalUnit } from "@psh/contracts";
import { Badge, Button, EmptyState } from "@psh/ui";
import { Building2 } from "lucide-react";
import { UNIT_TYPE_LABELS } from "./unit-type-labels";

// Plain markup, not TanStack Table — same reasoning as users-table.tsx: a few dozen
// rows at most, no sorting/filtering requirement.
export function UnitsTable({ units, onManage }: { units: OrganizationalUnit[]; onManage: (unitId: string) => void }) {
  if (units.length === 0) {
    return <EmptyState icon={Building2} title="No units yet" description="Create the first unit to get started." />;
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-0 text-left text-xs font-medium text-ink-muted">
            <th className="px-4 py-2.5">Code</th>
            <th className="px-4 py-2.5">Name</th>
            <th className="px-4 py-2.5">Type</th>
            <th className="px-4 py-2.5">City</th>
            <th className="px-4 py-2.5">Petty cash</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => (
            <tr key={unit.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 font-medium text-ink">{unit.code}</td>
              <td className="px-4 py-2.5 text-ink-muted">{unit.name}</td>
              <td className="px-4 py-2.5 text-ink-muted">{UNIT_TYPE_LABELS[unit.type]}</td>
              <td className="px-4 py-2.5 text-ink-muted">{unit.city ?? "—"}</td>
              <td className="px-4 py-2.5">
                <Badge variant={unit.pettyCashEnabled ? "positive" : "neutral"}>
                  {unit.pettyCashEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </td>
              <td className="px-4 py-2.5">
                <Badge variant={unit.isActive ? "positive" : "neutral"}>{unit.isActive ? "Active" : "Inactive"}</Badge>
              </td>
              <td className="px-4 py-2.5 text-right">
                <Button variant="secondary" size="sm" onClick={() => onManage(unit.id)}>
                  Manage
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
