"use client";

import type { ReportFilter, ReportKey, ReportPreset } from "@psh/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api-client";

// SRS §12.8: saved presets per Finance user. Scoped to one reportKey when given (the
// inline save/load controls on a report page), or every preset the current user owns
// when omitted (the /reports/presets management page).
export function usePresets(reportKey?: ReportKey) {
  const queryClient = useQueryClient();
  const queryKey = ["report-presets", reportKey ?? "all"];

  const listQuery = useQuery({
    queryKey,
    queryFn: () => {
      const params = reportKey ? `?reportKey=${reportKey}` : "";
      return apiFetch<ReportPreset[]>(`/reports/presets${params}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: { reportKey: ReportKey; name: string; filters: ReportFilter }) =>
      apiFetch<ReportPreset>("/reports/presets", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/reports/presets/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["report-presets"] }),
  });

  return {
    presets: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    createPreset: createMutation.mutate,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    deletePreset: deleteMutation.mutate,
  };
}
