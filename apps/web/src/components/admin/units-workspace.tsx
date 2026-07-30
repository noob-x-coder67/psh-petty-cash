"use client";

import type { OrganizationalUnit } from "@psh/contracts";
import { Button } from "@psh/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import { CreateUnitSheet } from "./create-unit-sheet";
import { UnitDetailSheet } from "./unit-detail-sheet";
import { UnitsTable } from "./units-table";

export function UnitsWorkspace({ initialUnits, canManage }: { initialUnits: OrganizationalUnit[]; canManage: boolean }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [detailUnitId, setDetailUnitId] = useState<string | null>(null);

  // initialUnits is server-fetched fresh on every router.refresh() the child sheets
  // trigger after a mutation — no client-side cache/state duplication of the list.
  const detailUnit = initialUnits.find((unit) => unit.id === detailUnitId) ?? null;

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Units</h1>
          <p className="mt-1 text-sm text-ink-muted">Petty-cash unit registry and metadata.</p>
        </div>
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Create unit
          </Button>
        ) : null}
      </div>

      <UnitsTable units={initialUnits} onManage={setDetailUnitId} />

      {canManage ? <CreateUnitSheet open={createOpen} onOpenChange={setCreateOpen} /> : null}

      <UnitDetailSheet
        unit={detailUnit}
        open={detailUnitId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailUnitId(null);
        }}
        canManage={canManage}
      />
    </div>
  );
}
