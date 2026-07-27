"use client";

import type { ExportStatusResponse, ReportExportFormatValue, ReportFilter, ReportKey } from "@psh/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "../../lib/api-client";

// Build Plan §3.7: POST /exports returns { exportId, status } immediately; this hook
// owns the polling loop (every 1.5s while PENDING) so every report view gets the same
// async-export behavior without re-implementing it per report.
export function useExport(reportKey: ReportKey, filter: ReportFilter) {
  const [exportId, setExportId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (format: ReportExportFormatValue) =>
      apiFetch<ExportStatusResponse>("/exports", {
        method: "POST",
        body: JSON.stringify({ reportKey, filters: filter, format }),
      }),
    onSuccess: (data) => setExportId(data.exportId),
  });

  const statusQuery = useQuery({
    queryKey: ["export-status", exportId],
    queryFn: () => apiFetch<ExportStatusResponse>(`/exports/${exportId}`),
    enabled: exportId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "READY" || status === "FAILED" ? false : 1500;
    },
  });

  function requestExport(format: ReportExportFormatValue): void {
    setExportId(null);
    createMutation.mutate(format);
  }

  return {
    requestExport,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    status: statusQuery.data,
    downloadUrl:
      exportId && statusQuery.data?.status === "READY" ? `/api/exports/${exportId}/download` : null,
  };
}
