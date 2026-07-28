import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  CircleSlash,
  Lock,
  MinusCircle,
  OctagonAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn.js";
import { Badge, type BadgeProps } from "./badge.js";

// The full application status vocabulary (audit found only the generic Badge existed;
// every page was picking its own icon/color per status ad hoc). Never color alone
// (SRS §11.3) — every status here pairs a Badge variant with a fixed icon and label.
const STATUS_MAP = {
  available: { label: "Available", variant: "positive", icon: CheckCircle2 },
  open: { label: "Open", variant: "positive", icon: CircleDot },
  closed: { label: "Closed", variant: "neutral", icon: Lock },
  active: { label: "Active", variant: "positive", icon: CheckCircle2 },
  inactive: { label: "Inactive", variant: "neutral", icon: CircleSlash },
  checked: { label: "Checked", variant: "positive", icon: CheckCircle2 },
  unchecked: { label: "Unchecked", variant: "attention", icon: MinusCircle },
  positive: { label: "Positive", variant: "positive", icon: CheckCircle2 },
  negative: { label: "Negative", variant: "negative", icon: XCircle },
  warning: { label: "Warning", variant: "attention", icon: AlertTriangle },
  hold: { label: "Compliance Hold", variant: "negative", icon: OctagonAlert },
  exception: { label: "Exception", variant: "analytical", icon: ShieldCheck },
  error: { label: "Error", variant: "negative", icon: XCircle },
  secure: { label: "Secure", variant: "positive", icon: ShieldCheck },
} as const satisfies Record<string, { label: string; variant: BadgeProps["variant"]; icon: typeof CheckCircle2 }>;

export type StatusKey = keyof typeof STATUS_MAP;

export interface StatusBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  status: StatusKey;
  /** Override the default label for this status (e.g. include a count or unit code). */
  label?: string;
}

export function StatusBadge({ status, label, className, ...props }: StatusBadgeProps) {
  const entry = STATUS_MAP[status];
  const Icon = entry.icon;
  return (
    <Badge variant={entry.variant} className={cn(className)} {...props}>
      <Icon className="h-3 w-3" aria-hidden />
      {label ?? entry.label}
    </Badge>
  );
}
