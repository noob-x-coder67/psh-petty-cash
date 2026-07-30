"use client";

import type { Allocation } from "@psh/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api-client";

export interface CreateAllocationInput {
  unitId: string;
  amount: string;
  issueDate: string;
  referenceNo?: string;
  paymentMode?: string;
  remarks?: string;
}

export interface ConfirmAllocationInput {
  allocationId: string;
  confirmedAmount: string;
  confirmedDate: string;
}

// unitId is needed (unlike the very first version of this hook) to invalidate the
// pending-allocations list on both create and confirm — creating adds a row to it,
// confirming removes one. Compliance (BR-013) still isn't invalidated here — that rule
// is Replenishment-only and never changes because of an Allocation.
export function useAllocation(unitId: string) {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: (input: CreateAllocationInput) =>
      apiFetch<Allocation>("/allocations", {
        method: "POST",
        body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["pending-allocations", unitId] }),
  });

  const confirm = useMutation({
    mutationFn: (input: ConfirmAllocationInput) =>
      apiFetch<Allocation>(`/allocations/${input.allocationId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ confirmedAmount: input.confirmedAmount, confirmedDate: input.confirmedDate }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["pending-allocations", unitId] }),
  });

  return {
    createAllocation: create.mutate,
    isCreating: create.isPending,
    createError: create.error,
    created: create.data,
    confirmAllocation: confirm.mutate,
    isConfirming: confirm.isPending,
    confirmError: confirm.error,
    confirmed: confirm.data,
  };
}

// `enabled` is passed in rather than computed here — the caller already knows whether
// the current user holds allocation.confirm_receipt (cash-flow/page.tsx), and firing
// this query for a role that doesn't would only ever 403.
export function usePendingAllocations(unitId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["pending-allocations", unitId],
    queryFn: () => apiFetch<Allocation[]>(`/allocations/pending/${unitId}`),
    enabled,
  });
}
