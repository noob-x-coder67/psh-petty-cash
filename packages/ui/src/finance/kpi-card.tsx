import { Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "../primitives/card.js";
import { Skeleton } from "../primitives/skeleton.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip.js";
import { cn } from "../lib/cn.js";

const ACCENTS = {
  primary: { icon: "text-royal-600", wash: "bg-royal-100", bar: "bg-royal-600" },
  success: { icon: "text-emerald-500", wash: "bg-emerald-500/10", bar: "bg-emerald-500" },
  warning: { icon: "text-amber-500", wash: "bg-amber-100", bar: "bg-amber-500" },
  danger: { icon: "text-coral-500", wash: "bg-coral-100", bar: "bg-coral-500" },
  info: { icon: "text-cyan-500", wash: "bg-cyan-500/10", bar: "bg-cyan-500" },
} as const;

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  accent?: keyof typeof ACCENTS;
  tooltip?: string;
  isLoading?: boolean;
  className?: string;
}

// Reusable KPI card (component system §15) — accepts an already-formatted/animated
// `value` node rather than a raw number, so the caller (which knows whether it's a
// Money amount or a plain count, and owns any number-animation hook) stays in control
// of formatting; this component only owns layout, semantic accent, and loading state.
export function KpiCard({ label, value, icon: Icon, accent = "primary", tooltip, isLoading, className }: KpiCardProps) {
  const { icon: iconClass, wash, bar } = ACCENTS[accent];

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col gap-3 p-4">
          <Skeleton className="h-8 w-8 rounded-control" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-28" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("relative overflow-hidden transition-shadow hover:shadow-2", className)}>
      <div aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", bar)} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-full", wash)}>
            <Icon className={cn("h-4.5 w-4.5", iconClass)} aria-hidden />
          </div>
          {tooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`About ${label}`}
                  className="psh-focus-ring rounded-control text-ink-muted/60 hover:text-ink-muted"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-56">{tooltip}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      </CardContent>
    </Card>
  );
}
