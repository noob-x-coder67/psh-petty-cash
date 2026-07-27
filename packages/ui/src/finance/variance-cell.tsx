import { cn } from "../lib/cn.js";
import { BalanceDelta } from "./balance-delta.js";
import { Money } from "./money.js";

// Presentational only — month-close variance (expected vs. counted cash) isn't computed
// until Phase 7. Reusable wherever an actual-vs-expected pair needs a compact cell.
export interface VarianceCellProps {
  expected: string | number;
  actual: string | number;
  className?: string;
}

export function VarianceCell({ expected, actual, className }: VarianceCellProps) {
  const diff = Number(actual) - Number(expected);
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <Money value={actual} className="text-sm text-ink" />
      {diff === 0 ? <span className="text-xs text-ink-muted">Matched</span> : <BalanceDelta value={diff} />}
    </div>
  );
}
