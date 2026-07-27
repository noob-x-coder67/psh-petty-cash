import { cn } from "../lib/cn.js";

// Presentational only — the three-month rolling compliance data itself (BR-013) isn't
// computed until Month Close (Phase 7). This component just renders whatever status
// sequence it's given.
export type ComplianceMonthStatus = "CLOSED" | "OPEN" | "HELD" | "EXCEPTION";

export interface ComplianceRibbonProps {
  months: Array<{ label: string; status: ComplianceMonthStatus }>;
  className?: string;
}

const STATUS_STYLE: Record<ComplianceMonthStatus, string> = {
  CLOSED: "bg-emerald-500",
  OPEN: "bg-ink-muted/40",
  HELD: "bg-coral-500",
  EXCEPTION: "bg-amber-500",
};

const STATUS_LABEL: Record<ComplianceMonthStatus, string> = {
  CLOSED: "Closed",
  OPEN: "Open",
  HELD: "Held",
  EXCEPTION: "Exception",
};

export function ComplianceRibbon({ months, className }: ComplianceRibbonProps) {
  return (
    <ol className={cn("flex items-center gap-2", className)}>
      {months.map((month) => (
        <li key={month.label} className="flex flex-col items-center gap-1">
          <span
            className={cn("h-2 w-8 rounded-full", STATUS_STYLE[month.status])}
            role="img"
            aria-label={`${month.label}: ${STATUS_LABEL[month.status]}`}
          />
          <span className="text-[10px] text-ink-muted">{month.label}</span>
        </li>
      ))}
    </ol>
  );
}
