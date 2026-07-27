"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "../lib/cn.js";
import { usePrefersReducedMotion } from "../lib/reduced-motion.js";

// Register rows and Voucher Detail open as a side drawer rather than a route change
// (SRS §12.6: "Row opens a detail drawer or route, not a sidebar navigation shell") —
// same Radix Dialog underneath as the centered Dialog, side-anchored and slide-animated.
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

export interface SheetContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  open: boolean;
  side?: "right" | "bottom";
}

export const SheetContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  ({ className, children, open, side = "right", ...props }, ref) => {
    const reducedMotion = usePrefersReducedMotion();
    const offscreen = side === "right" ? { x: "100%" } : { y: "100%" };
    const onscreen = side === "right" ? { x: 0 } : { y: 0 };

    return (
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-midnight-950/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.18 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content ref={ref} asChild forceMount {...props}>
              <motion.div
                className={cn(
                  "psh-focus-ring fixed z-50 bg-surface-1 shadow-3",
                  side === "right"
                    ? "inset-y-0 right-0 h-full w-full max-w-md border-l border-border"
                    : "inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-feature border-t border-border",
                  className,
                )}
                initial={reducedMotion ? { opacity: 0 } : offscreen}
                animate={reducedMotion ? { opacity: 1 } : onscreen}
                exit={reducedMotion ? { opacity: 0 } : offscreen}
                transition={
                  reducedMotion ? { duration: 0 } : { duration: 0.32, type: "spring", bounce: 0.1 }
                }
              >
                {children}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    );
  },
);
SheetContent.displayName = "SheetContent";
