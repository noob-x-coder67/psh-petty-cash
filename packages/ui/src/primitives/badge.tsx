import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

// Semantic accents only — SRS §11.3: "Color is always paired with text/icon meaning
// and never used alone," so every consumer must also render a label or icon, never a
// bare color swatch.
const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      neutral: "bg-surface-0 text-ink-muted",
      positive: "bg-emerald-500/10 text-emerald-500",
      attention: "bg-amber-100 text-amber-500",
      negative: "bg-coral-100 text-coral-500",
      analytical: "bg-violet-100 text-violet-500",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant, ...props }, ref) => (
  <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
));
Badge.displayName = "Badge";
