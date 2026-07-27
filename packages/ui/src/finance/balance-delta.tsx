import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Money } from "./money.js";

export interface BalanceDeltaProps {
  value: string | number;
  className?: string;
}

export function BalanceDelta({ value, className }: BalanceDeltaProps) {
  const numeric = Number(value);
  const isZero = numeric === 0;
  const isNegative = numeric < 0;
  const Icon = isNegative ? ArrowDown : ArrowUp;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        isZero ? "text-ink-muted" : isNegative ? "text-coral-500" : "text-emerald-500",
        className,
      )}
    >
      {isZero ? null : <Icon className="h-3 w-3" aria-hidden />}
      <Money value={Math.abs(numeric)} />
    </span>
  );
}
