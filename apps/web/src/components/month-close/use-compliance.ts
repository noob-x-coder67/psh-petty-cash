"use client";

import type { ComplianceResponse } from "@psh/contracts";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api-client";

export function useCompliance(unitId: string | undefined) {
  return useQuery({
    queryKey: ["compliance", unitId],
    queryFn: () => apiFetch<ComplianceResponse>(`/compliance/${unitId}`),
    enabled: unitId !== undefined,
  });
}
