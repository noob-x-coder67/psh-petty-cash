"use client";

import type { ReportDatasetResponse, ReportFilter, ReportKey } from "@psh/contracts";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api-client";

// GET /reports/:reportKey takes its filter object as a single JSON query string — the
// same shape POST /exports (Phase 6d) will take as a body, so a saved preset (Phase 6e),
// the live preview and an export all serialize from the exact same ReportFilter value.
export function useReportQuery(reportKey: ReportKey, filter: ReportFilter, enabled = true) {
  return useQuery({
    queryKey: ["report", reportKey, filter],
    queryFn: () =>
      apiFetch<ReportDatasetResponse>(`/reports/${reportKey}?filters=${encodeURIComponent(JSON.stringify(filter))}`),
    enabled,
  });
}
