"use client";

import type { OrganizationalUnit, ReportFilter } from "@psh/contracts";
import { Input } from "@psh/ui";

export type ReportFilterField =
  | "dateRange"
  | "unit"
  | "category"
  | "vendor"
  | "amountRange"
  | "checked"
  | "hasBill"
  | "actorSearch"
  | "action"
  | "entityType";

export interface ReportFilterBarProps {
  value: ReportFilter;
  onChange: (next: ReportFilter) => void;
  units: OrganizationalUnit[];
  showUnitPicker: boolean;
  fields: ReportFilterField[];
}

const selectClassName = "psh-focus-ring h-10 rounded-control border border-border bg-surface-1 px-2 text-sm text-ink";

// Shared across every implemented report view — which fields actually show is per-report
// (`fields`), since e.g. RPT-04 ignores its own category filter (it's a category
// breakdown; see reports.service.ts) and hides that control here rather than showing a
// filter that silently does nothing.
export function ReportFilterBar({ value, onChange, units, showUnitPicker, fields }: ReportFilterBarProps) {
  function patch(next: Partial<ReportFilter>): void {
    onChange({ ...value, ...next });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {fields.includes("dateRange") ? (
        <>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            From
            <Input
              aria-label="Date from"
              type="date"
              value={value.dateFrom ?? ""}
              onChange={(event) => patch({ dateFrom: event.target.value || undefined })}
              className="w-40"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            To
            <Input
              aria-label="Date to"
              type="date"
              value={value.dateTo ?? ""}
              onChange={(event) => patch({ dateTo: event.target.value || undefined })}
              className="w-40"
            />
          </label>
        </>
      ) : null}

      {fields.includes("unit") && showUnitPicker ? (
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Unit
          <select
            aria-label="Unit"
            className={selectClassName}
            value={value.unitIds?.[0] ?? ""}
            onChange={(event) => patch({ unitIds: event.target.value ? [event.target.value] : undefined })}
          >
            <option value="">All units</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.code}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {fields.includes("category") ? (
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Category
          <select
            aria-label="Category"
            className={selectClassName}
            value={value.category ?? ""}
            onChange={(event) =>
              patch({ category: (event.target.value || undefined) as ReportFilter["category"] })
            }
          >
            <option value="">All categories</option>
            <option value="BUILDING">Building</option>
            <option value="VEHICLE">Vehicle</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
      ) : null}

      {fields.includes("vendor") ? (
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Vendor
          <Input
            aria-label="Vendor search"
            placeholder="Vendor / payee..."
            value={value.vendorSearch ?? ""}
            onChange={(event) => patch({ vendorSearch: event.target.value || undefined })}
            className="w-48"
          />
        </label>
      ) : null}

      {fields.includes("amountRange") ? (
        <>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Min amount
            <Input
              aria-label="Minimum amount"
              type="number"
              value={value.amountMin ?? ""}
              onChange={(event) => patch({ amountMin: event.target.value || undefined })}
              className="w-32"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Max amount
            <Input
              aria-label="Maximum amount"
              type="number"
              value={value.amountMax ?? ""}
              onChange={(event) => patch({ amountMax: event.target.value || undefined })}
              className="w-32"
            />
          </label>
        </>
      ) : null}

      {fields.includes("checked") ? (
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Receipt
          <select
            aria-label="Receipt checked status"
            className={selectClassName}
            value={value.checked === undefined ? "" : String(value.checked)}
            onChange={(event) =>
              patch({ checked: event.target.value === "" ? undefined : event.target.value === "true" })
            }
          >
            <option value="">Checked + Unchecked</option>
            <option value="true">Checked only</option>
            <option value="false">Unchecked only</option>
          </select>
        </label>
      ) : null}

      {fields.includes("actorSearch") ? (
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Actor
          <Input
            aria-label="Actor name search"
            placeholder="Actor name..."
            value={value.actorSearch ?? ""}
            onChange={(event) => patch({ actorSearch: event.target.value || undefined })}
            className="w-44"
          />
        </label>
      ) : null}

      {fields.includes("action") ? (
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Action
          <Input
            aria-label="Audit action"
            placeholder="e.g. EXPENSE_CREATE"
            value={value.action ?? ""}
            onChange={(event) => patch({ action: event.target.value || undefined })}
            className="w-44"
          />
        </label>
      ) : null}

      {fields.includes("entityType") ? (
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Entity type
          <Input
            aria-label="Audit entity type"
            placeholder="e.g. expense_vouchers"
            value={value.entityType ?? ""}
            onChange={(event) => patch({ entityType: event.target.value || undefined })}
            className="w-44"
          />
        </label>
      ) : null}

      {fields.includes("hasBill") ? (
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Bill
          <select
            aria-label="Bill present status"
            className={selectClassName}
            value={value.hasBill === undefined ? "" : String(value.hasBill)}
            onChange={(event) =>
              patch({ hasBill: event.target.value === "" ? undefined : event.target.value === "true" })
            }
          >
            <option value="">Bill present + missing</option>
            <option value="true">Bill present only</option>
            <option value="false">Bill missing only</option>
          </select>
        </label>
      ) : null}
    </div>
  );
}
