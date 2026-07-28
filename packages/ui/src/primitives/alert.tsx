import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn.js";

const alertVariants = cva("flex gap-3 rounded-card border p-4", {
  variants: {
    variant: {
      info: "border-cyan-500/25 bg-cyan-500/8 text-ink",
      success: "border-emerald-500/25 bg-emerald-500/8 text-ink",
      warning: "border-amber-500/30 bg-amber-100 text-ink",
      danger: "border-coral-500/30 bg-coral-100 text-ink",
    },
  },
  defaultVariants: { variant: "info" },
});

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: OctagonAlert,
} as const;

const ICON_COLOR = {
  info: "text-cyan-500",
  success: "text-emerald-500",
  warning: "text-amber-500",
  danger: "text-coral-500",
} as const;

export interface AlertProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title: string;
  action?: ReactNode;
}

// Shared alert shape for negative balances, compliance holds, replenishment
// exceptions, validation errors and success confirmations (per the redesign brief) —
// consolidates what was previously built ad hoc per page (audit found no existing
// AlertPanel). Semantics always carry both an icon AND text, never color alone
// (SRS §11.3), and use role="alert" only for warning/danger so success/info don't
// interrupt screen-reader users unnecessarily.
export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "info", title, action, children, ...props }, ref) => {
    const Icon = ICONS[variant ?? "info"];
    return (
      <div
        ref={ref}
        role={variant === "warning" || variant === "danger" ? "alert" : "status"}
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        <Icon className={cn("h-5 w-5 shrink-0", ICON_COLOR[variant ?? "info"])} aria-hidden />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-ink">{title}</p>
          {children ? <div className="text-sm text-ink-muted">{children}</div> : null}
          {action ? <div className="pt-1">{action}</div> : null}
        </div>
      </div>
    );
  },
);
Alert.displayName = "Alert";
