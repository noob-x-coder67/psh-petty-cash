"use client";

import type { MonthlyClosing } from "@psh/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api-client";

export interface Period {
  year: number;
  month: number;
}

export function useMonthlyClosing(unitId: string, period: Period) {
  const queryClient = useQueryClient();
  const queryKey = ["monthly-closing", unitId, period.year, period.month];

  const query = useQuery({
    queryKey,
    queryFn: () => apiFetch<MonthlyClosing>(`/monthly-close/${unitId}/${period.year}/${period.month}`),
  });

  const recordCashCount = useMutation({
    mutationFn: (input: { physicalCashCount: string; remarks?: string }) =>
      apiFetch<MonthlyClosing>("/monthly-close", {
        method: "POST",
        body: JSON.stringify({ unitId, periodYear: period.year, periodMonth: period.month, ...input }),
      }),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const closeMonth = useMutation({
    mutationFn: (id: string) => apiFetch<MonthlyClosing>(`/monthly-close/${id}/close`, { method: "POST" }),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const reopenMonth = useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      apiFetch<MonthlyClosing>(`/monthly-close/${input.id}/reopen`, {
        method: "POST",
        body: JSON.stringify({ reason: input.reason }),
      }),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  return {
    closing: query.data,
    isLoading: query.isLoading,
    recordCashCount: recordCashCount.mutate,
    isRecording: recordCashCount.isPending,
    recordError: recordCashCount.error,
    closeMonth: closeMonth.mutate,
    isClosing: closeMonth.isPending,
    closeError: closeMonth.error,
    reopenMonth: reopenMonth.mutate,
    isReopening: reopenMonth.isPending,
    reopenError: reopenMonth.error,
  };
}
