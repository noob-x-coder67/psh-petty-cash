"use client";

import type { OrganizationalUnit, ReportFilter, ReportKey } from "@psh/contracts";
import { useState } from "react";
import { ExportButton } from "./export-button";
import { GenericReportView } from "./generic-report-view";
import { PresetControls } from "./preset-controls";
import { ReportFilterBar, type ReportFilterField } from "./report-filter-bar";
import { ReportHeader } from "./report-header";
import { Rpt01View } from "./rpt01-view";
import { Rpt03View } from "./rpt03-view";
import { Rpt04View } from "./rpt04-view";
import { Rpt06View } from "./rpt06-view";
import { Rpt14View } from "./rpt14-view";
import { useReportQuery } from "./use-report-query";

const REPORT_TITLES: Record<string, string> = {
  "RPT-01": "Consolidated Cash Position",
  "RPT-02": "Unit Ledger",
  "RPT-03": "Monthly Expense Statement",
  "RPT-04": "Category Analysis",
  "RPT-05": "Vendor / Payee Analysis",
  "RPT-06": "Receipt Control",
  "RPT-07": "Negative Balance",
  "RPT-08": "Allocation and Replenishment",
  "RPT-09": "Three-Month Compliance",
  "RPT-10": "Cash Count and Variance",
  "RPT-11": "Backdated and Duplicate Warnings",
  "RPT-12": "Monthly Attachment Index",
  "RPT-13": "User Activity",
  "RPT-14": "Audit Trail",
  "RPT-15": "Cross-Unit Comparison",
  "RPT-16": "Line-Item Analysis",
};

// Which filters are shown per report — matches exactly what reports.repository.ts/
// reports.service.ts actually wire up, so a control is never shown for a filter that
// would silently do nothing (e.g. RPT-01/04 both hide "Category" for their own reasons).
const REPORT_FIELDS: Record<string, ReportFilterField[]> = {
  "RPT-01": ["dateRange", "unit"],
  "RPT-02": ["dateRange", "unit"],
  "RPT-03": ["dateRange", "unit", "categoryId", "vendor", "amountRange", "checked", "hasBill"],
  "RPT-04": ["dateRange", "unit", "vendor", "amountRange", "checked", "hasBill"],
  "RPT-05": ["dateRange", "unit", "vendor"],
  "RPT-06": ["dateRange", "unit", "vendor", "checked", "hasBill"],
  "RPT-07": ["dateRange", "unit"],
  "RPT-08": ["dateRange", "unit"],
  "RPT-09": ["dateRange", "unit"],
  "RPT-10": ["dateRange", "unit"],
  "RPT-11": ["dateRange", "unit"],
  "RPT-12": ["dateRange", "unit"],
  "RPT-13": ["dateRange", "unit"],
  "RPT-14": ["dateRange", "unit", "actorSearch", "action", "entityType"],
  "RPT-15": ["dateRange", "unit"],
  "RPT-16": ["dateRange", "unit", "categoryId", "vendor", "amountRange", "checked", "hasBill"],
};

// The 4 flagship reports (Phase 6b/6c) get bespoke chart/table views; every other
// implemented report (Phase 6e) renders through GenericReportView, matching Build
// Plan §3.1's "filter-rich, exportable" bar without a bespoke component per report.
// RPT-14 (Phase 8) is also bespoke, but for a different reason than the flagship 4 —
// it's cursor-paginated (own useInfiniteQuery), not a richer single-shot chart, so it
// bypasses useReportQuery entirely rather than just rendering `data` differently.
const BESPOKE_REPORT_KEYS: ReadonlySet<string> = new Set(["RPT-01", "RPT-03", "RPT-04", "RPT-06", "RPT-14"]);

export function ReportView({
  reportKey,
  units,
  showUnitPicker,
}: {
  reportKey: ReportKey;
  units: OrganizationalUnit[];
  showUnitPicker: boolean;
}) {
  const [filter, setFilter] = useState<ReportFilter>({});
  const isRpt14 = reportKey === "RPT-14";
  const { data, isLoading, isError, error } = useReportQuery(reportKey, filter, !isRpt14);
  const title = REPORT_TITLES[reportKey] ?? reportKey;
  const fields = REPORT_FIELDS[reportKey] ?? [];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ReportFilterBar
          value={filter}
          onChange={setFilter}
          units={units}
          showUnitPicker={showUnitPicker}
          fields={fields}
        />
        <ExportButton reportKey={reportKey} filter={filter} />
      </div>

      <PresetControls reportKey={reportKey} filter={filter} onApply={setFilter} />

      {isRpt14 ? (
        <Rpt14View filter={filter} />
      ) : (
        <>
          {isLoading ? <p className="text-sm text-ink-muted">Loading report...</p> : null}
          {isError ? (
            <p className="text-sm text-coral-500">
              Could not load this report{error instanceof Error ? `: ${error.message}` : "."}
            </p>
          ) : null}

          {data ? (
            <>
              <ReportHeader title={title} response={data} />
              {data.reportKey === "RPT-01" ? <Rpt01View response={data} /> : null}
              {data.reportKey === "RPT-03" ? <Rpt03View response={data} /> : null}
              {data.reportKey === "RPT-04" ? <Rpt04View response={data} /> : null}
              {data.reportKey === "RPT-06" ? <Rpt06View response={data} /> : null}
              {!BESPOKE_REPORT_KEYS.has(data.reportKey) ? (
                <GenericReportView rows={data.rows as Array<Record<string, unknown>>} />
              ) : null}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
