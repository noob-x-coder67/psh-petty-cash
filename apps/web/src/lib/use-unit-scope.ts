"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Build Plan §4.2: unit scope is a query parameter (?unit=PSH-SOH), not a path segment,
// so switching units doesn't duplicate the route tree or break the shared-layout
// transition (SRS §13.3 "Unit switch").
export function useUnitScope(): {
  unitCode: string | null;
  setUnitCode: (code: string | null) => void;
} {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const unitCode = searchParams.get("unit");

  function setUnitCode(code: string | null): void {
    const params = new URLSearchParams(searchParams.toString());
    if (code) {
      params.set("unit", code);
    } else {
      params.delete("unit");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return { unitCode, setUnitCode };
}
