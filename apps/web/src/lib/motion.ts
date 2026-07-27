"use client";

import { useReducedMotion, type Transition, type Variants } from "motion/react";

// Every screen-level animation variant in apps/web goes through this — Build Plan §4.6:
// "a lint rule flags direct motion.* transitions that bypass it" (AC-019, NFR-014).
// packages/ui primitives use their own smaller local helper
// (packages/ui/src/lib/reduced-motion.ts) since packages/ui can't import from apps/web.
export function usePrefersReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}

export function reduced(transition: Transition, reducedMotion: boolean): Transition {
  return reducedMotion ? { duration: 0 } : transition;
}

// SRS §13.3 "App entry": "Institutional mark resolves into masthead; data surfaces
// reveal in logical order." Used for the masthead itself and, staggered via
// transition.delay, the cards beneath it.
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

// SRS §13.2: "Use subtle stagger for KPI and unit-grid reveal."
export function staggerContainer(staggerMs = 60): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: staggerMs / 1000 } },
  };
}
