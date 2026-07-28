import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../lib/cn.js";

// A faint top-to-bottom gradient (not a flat fill) plus a hairline top highlight —
// enough to read as a considered surface rather than "a div with a border," without
// crossing into the glass treatment reserved for the login card/dropdowns/dialogs
// (redesign brief: "do not make every card transparent glass; use glassmorphism
// selectively"). Every consumer (KpiCard, UnitPulseCard, page sections) inherits this
// for free instead of needing its own surface treatment.
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-card border border-border bg-surface-1 shadow-1", className)}
      style={{
        backgroundImage: "linear-gradient(180deg, var(--color-elevated) 0%, var(--color-surface-1) 100%)",
        ...style,
      }}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

// h2 — every Card in this app sits directly under the page's own h1 (no intervening
// heading level), so h2 keeps the document outline valid (axe's heading-order check).
export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-base font-semibold text-ink", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-ink-muted", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2 p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";
