import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "../lib/cn.js";

// BR-008/FR-CHK-004/005: Checked means Finance viewed the receipt — never approval,
// never a balance change. This marker only ever renders that binary state.
export interface CheckedMarkerProps {
  checked: boolean;
  className?: string;
}

export function CheckedMarker({ checked, className }: CheckedMarkerProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        checked ? "text-emerald-500" : "text-ink-muted",
        className,
      )}
    >
      {checked ? (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Circle className="h-3.5 w-3.5" aria-hidden />
      )}
      {checked ? "Checked" : "Unchecked"}
    </span>
  );
}
