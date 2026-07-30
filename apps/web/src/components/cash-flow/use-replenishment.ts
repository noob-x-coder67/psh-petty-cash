"use client";

import type { Replenishment } from "@psh/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api-client";

export interface CreateReplenishmentInput {
  unitId: string;
  amount: string;
  issueDate: string;
  referenceNo?: string;
  paymentMode?: string;
  remarks?: string;
  exceptionReason?: string;
}

export interface ConfirmReplenishmentInput {
  replenishmentId: string;
  confirmedAmount: string;
  confirmedDate: string;
}

export function useReplenishment(unitId: string) {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: (input: CreateReplenishmentInput) =>
      apiFetch<Replenishment>("/replenishments", {
        method: "POST",
        body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["compliance", unitId] });
      void queryClient.invalidateQueries({ queryKey: ["pending-replenishments", unitId] });
    },
  });

  // Invalidates the pending-replenishments list (confirming removes a row from it) —
  // still no compliance invalidation here, same reasoning as before: confirming
  // doesn't change three-month compliance, which is purely MonthClose status.
  const confirm = useMutation({
    mutationFn: (input: ConfirmReplenishmentInput) =>
      apiFetch<Replenishment>(`/replenishments/${input.replenishmentId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ confirmedAmount: input.confirmedAmount, confirmedDate: input.confirmedDate }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["pending-replenishments", unitId] }),
  });

  return {
    createReplenishment: create.mutate,
    isCreating: create.isPending,
    createError: create.error,
    created: create.data,
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
