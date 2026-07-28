import { AlertOctagon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

// Built from existing primitives (icon + type), not an illustration asset — per the
// admin-page brief: "well-designed empty-state illustration made from UI shapes/icons."
// Reused for genuinely-empty data (no expenses this period, no reports match a filter)
// as well as the Administration landing page.
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-surface-0 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-interactive-surface">
        <Icon className="h-6 w-6 text-ink-muted" aria-hidden />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

// Distinct from EmptyState: coral-tinted, fixed icon — communicates "something went
// wrong" rather than "nothing here yet," per the brief's separate ErrorState requirement.
export function ErrorState({
  title = "Something went wrong",
  description = "The data couldn't be loaded. Try again, or contact support if this keeps happening.",
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-coral-500/25 bg-coral-100 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-coral-500/15">
        <AlertOctagon className="h-6 w-6 text-coral-500" aria-hidden />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
