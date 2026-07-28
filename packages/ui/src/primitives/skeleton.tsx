import { cn } from "../lib/cn.js";

// Loading placeholder for KPI values, cards and table rows — replaces bare "Loading…"
// text so layout doesn't shift once real content arrives. Uses a plain CSS animation
// (not Motion) since it's purely decorative chrome with no state to explain; respects
// prefers-reduced-motion via tokens.css's global reduced-motion media query.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-control bg-skeleton", className)} />;
}
