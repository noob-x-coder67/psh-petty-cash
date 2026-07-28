import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

const iconButtonVariants = cva(
  "psh-focus-ring inline-flex shrink-0 items-center justify-center rounded-control transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        ghost: "text-ink-muted hover:bg-interactive-surface hover:text-ink",
        secondary: "border border-border bg-surface-1 text-ink hover:bg-interactive-surface",
        primary: "bg-royal-600 text-white hover:bg-royal-500",
      },
      size: {
        sm: "h-8 w-8 [&_svg]:h-4 [&_svg]:w-4",
        md: "h-(--control-height-md) w-(--control-height-md) [&_svg]:h-4.5 [&_svg]:w-4.5",
        lg: "h-(--control-height-lg) w-(--control-height-lg) [&_svg]:h-5 [&_svg]:w-5",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

// SRS §13.4: "icon-only buttons require an accessible label" — `aria-label` is
// required (not optional) here rather than merely encouraged, so a missing label is a
// type error at the call site instead of a silent a11y regression. Pair with
// TooltipTrigger/TooltipContent for the visible-on-hover label SRS also asks for.
export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(iconButtonVariants({ variant, size }), className)} {...props} />
  ),
);
IconButton.displayName = "IconButton";
