"use client";

import type { Replenishment } from "@psh/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api-client";

// ADR-0010: direct-create is gone — a Replenishment only ever comes from
// ReplenishmentRequestApprovalQueue's approve/override actions (use-replenishment-request.ts).
// This hook now only covers what didn't change: hand-to-hand confirm receipt (ADR-0009).
export interface ConfirmReplenishmentInput {
  replenishmentId: string;
  confirmedDate: string;
}

export function useReplenishment(unitId: string) {
  const queryClient = useQueryClient();

  // Invalidates the pending-replenishments list (confirming removes a row from it) —
  // still no compliance invalidation here, same reasoning as before: confirming
  // doesn't change three-month compliance, which is purely MonthClose status.
  const confirm = useMutation({
    mutationFn: (input: ConfirmReplenishmentInput) =>
      apiFetch<Replenishment>(`/replenishments/${input.replenishmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ confirmedDate: input.confirmedDate }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["pending-replenishments", unitId] }),
  });

  return {
    confirmReplenishment: confirm.mutate,
    isConfirming: confirm.isPending,
    confirmError: confirm.error,
    confirmed: confirm.data,
  };
}

// Same reasoning as usePendingAllocations — `enabled` reflects whether the caller
// already knows the current user holds allocation.confirm_receipt.
export function usePendingReplenishments(unitId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["pending-replenishments", unitId],
    queryFn: () => apiFetch<Replenishment[]>(`/replenishments/pending/${unitId}`),
    enabled,
  });
}
