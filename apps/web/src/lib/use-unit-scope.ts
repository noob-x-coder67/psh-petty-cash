"use client";

import { useRouter, useSearchParams } from "next/navigation";

// Build Plan §4.2: unit scope is a query parameter (?unit=PSH-SOH), not a path segment,
// so switching units doesn't duplicate the route tree or break the shared-layout
// transition (SRS §13.3 "Unit switch").
export function useUnitScope(): { unitCode: string | null; setUnitCode: (code: string) => void } {
  const searchParams = useSearchParams();
  const router = useRouter();
  const unitCode = searchParams.get("unit");

  function setUnitCode(code: string): void {
    const params = new URLSearchParams(searchParams.toString());
    params.set("unit", code);
    router.push(`?${params.toString()}`);
  }

  return { unitCode, setUnitCode };
}
