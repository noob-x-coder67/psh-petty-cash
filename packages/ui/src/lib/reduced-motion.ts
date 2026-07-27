"use client";

import { useReducedMotion } from "motion/react";

// Every Motion-animated primitive in packages/ui consumes this rather than calling
// useReducedMotion() directly, so reduced-motion handling stays consistent as primitives
// are added (AC-019, NFR-014). apps/web's own screen-level animation variants use a
// separate helper in apps/web/src/lib/motion.ts — packages/ui can't import from
// apps/web (Build Plan §1.3 boundary rule), so this is intentionally a second, smaller
// helper, not a shared one.
export function usePrefersReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}
