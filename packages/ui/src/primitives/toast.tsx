"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { CheckCircle2, Info, OctagonAlert, X } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "../lib/cn.js";

export const ToastProvider = ToastPrimitive.Provider;

export const ToastViewport = forwardRef<
  ElementRef<typeof ToastPrimitive.Viewport>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 right-0 z-toast flex w-full max-w-sm flex-col gap-2 p-4 outline-none sm:bottom-4 sm:right-4",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

// Entrance/exit uses a plain CSS transition keyed off Radix's data-state/data-swipe
// attributes (not a "tailwindcss-animate" plugin utility — that plugin isn't installed,
// and every other animated primitive in this package already uses Motion or plain CSS
// rather than adding a new Tailwind plugin dependency).
const toastVariants = cva(
  "psh-focus-ring pointer-events-auto grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-card border p-4 shadow-3 transition-all duration-(--duration-base) ease-standard data-[state=open]:translate-y-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 data-swipe-end:translate-x-(--radix-toast-swipe-end-x)",
  {
    variants: {
      variant: {
        info: "border-border bg-elevated",
        success: "border-emerald-500/25 bg-elevated",
        danger: "border-coral-500/30 bg-elevated",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const ICONS = { info: Info, success: CheckCircle2, danger: OctagonAlert } as const;
const ICON_COLOR = { info: "text-cyan-500", success: "text-emerald-500", danger: "text-coral-500" } as const;

export interface ToastRootProps
  extends ComponentPropsWithoutRef<typeof ToastPrimitive.Root>,
    VariantProps<typeof toastVariants> {}

export const Toast = forwardRef<ElementRef<typeof ToastPrimitive.Root>, ToastRootProps>(
  ({ className, variant = "info", children, ...props }, ref) => {
    const Icon = ICONS[variant ?? "info"];
    return (
      <ToastPrimitive.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props}>
        <Icon className={cn("h-5 w-5", ICON_COLOR[variant ?? "info"])} aria-hidden />
        <div className="space-y-1">{children}</div>
        <ToastPrimitive.Close
          aria-label="Dismiss notification"
          className="psh-focus-ring rounded-control p-1 text-ink-muted hover:bg-interactive-surface hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </ToastPrimitive.Close>
      </ToastPrimitive.Root>
    );
  },
);
Toast.displayName = "Toast";

export const ToastTitle = forwardRef<
  ElementRef<typeof ToastPrimitive.Title>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title ref={ref} className={cn("text-sm font-semibold text-ink", className)} {...props} />
));
ToastTitle.displayName = "ToastTitle";

export const ToastDescription = forwardRef<
  ElementRef<typeof ToastPrimitive.Description>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description ref={ref} className={cn("text-sm text-ink-muted", className)} {...props} />
));
ToastDescription.displayName = "ToastDescription";

export const ToastAction = ToastPrimitive.Action;
export const ToastClose = ToastPrimitive.Close;
