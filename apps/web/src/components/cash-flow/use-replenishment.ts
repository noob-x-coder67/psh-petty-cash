"use client";

import type { Replenishment } from "@psh/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

export function useReplenishment(unitId: string) {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: (input: CreateReplenishmentInput) =>
      apiFetch<Replenishment>("/replenishments", {
        method: "POST",
        body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["compliance", unitId] }),
  });

  return {
    createReplenishment: create.mutate,
    isCreating: create.isPending,
    createError: create.error,
    created: create.data,
  };
}
