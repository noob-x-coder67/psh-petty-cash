"use client";

import type { ReplenishmentRequest } from "@psh/contracts";
import { randomUuid } from "@psh/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api-client";

// ADR-0010: Replenishment Request -> Approve -> Confirm. This hook covers the unit's
// side (submit + its own request history); useReplenishmentApprovalQueue below covers
// Finance's side (list pending across units, approve, reject); useReplenishmentOverride
// covers the Finance-initiated audited-exception path. Confirming receipt is unchanged
// and still lives in use-replenishment.ts.
export interface SubmitReplenishmentRequestInput {
  unitId: string;
  amount: string;
  reason: string;
}

export function useReplenishmentRequest(unitId: string) {
  const queryClient = useQueryClient();

  const submit = useMutation({
    mutationFn: (input: SubmitReplenishmentRequestInput) =>
      apiFetch<ReplenishmentRequest>("/replenishment-requests", {
        method: "POST",
        body: JSON.stringify({ ...input, idempotencyKey: randomUuid() }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["replenishment-requests", "unit", unitId] }),
  });

  return {
    submitRequest: submit.mutate,
    isSubmitting: submit.isPending,
    submitError: submit.error,
    submitted: submit.data,
  };
}

export function useReplenishmentRequestsForUnit(unitId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["replenishment-requests", "unit", unitId],
    queryFn: () => apiFetch<ReplenishmentRequest[]>(`/replenishment-requests/unit/${unitId}`),
    enabled,
  });
}

export interface ApproveReplenishmentRequestInput {
  requestId: string;
  issueDate: string;
  referenceNo?: string;
  paymentMode?: string;
  remarks?: string;
}

export interface RejectReplenishmentRequestInput {
  requestId: string;
  rejectionReason: string;
}

export function useReplenishmentApprovalQueue() {
  const queryClient = useQueryClient();

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["replenishment-requests", "pending"] });

  const approve = useMutation({
    mutationFn: ({ requestId, ...body }: ApproveReplenishmentRequestInput) =>
      apiFetch<ReplenishmentRequest>(`/replenishment-requests/${requestId}/approve`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: ({ requestId, ...body }: RejectReplenishmentRequestInput) =>
      apiFetch<ReplenishmentRequest>(`/replenishment-requests/${requestId}/reject`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: invalidate,
  });

  return {
    approveRequest: approve.mutate,
    isApproving: approve.isPending,
    approveError: approve.error,
    rejectRequest: reject.mutate,
    isRejecting: reject.isPending,
    rejectError: reject.error,
  };
}

export function usePendingReplenishmentRequests(enabled: boolean) {
  return useQuery({
    queryKey: ["replenishment-requests", "pending"],
    queryFn: () => apiFetch<ReplenishmentRequest[]>("/replenishment-requests/pending"),
    enabled,
  });
}

// Finance-initiated audited-exception path (ADR-0010/BR-013) — creates the request and
// approves it in the same atomic step, only usable while the unit is genuinely held.
export interface SubmitReplenishmentOverrideInput {
  unitId: string;
  amount: string;
  reason: string;
  exceptionReason: string;
  issueDate: string;
  referenceNo?: string;
  paymentMode?: string;
  remarks?: string;
}

export function useReplenishmentOverride() {
  const queryClient = useQueryClient();

  const submit = useMutation({
    mutationFn: (input: SubmitReplenishmentOverrideInput) =>
      apiFetch<ReplenishmentRequest>("/replenishment-requests/override", {
        method: "POST",
        body: JSON.stringify({ ...input, idempotencyKey: randomUuid() }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["replenishment-requests"] }),
  });

  return {
    submitOverride: submit.mutate,
    isSubmittingOverride: submit.isPending,
    overrideError: submit.error,
    overridden: submit.data,
  };
}
