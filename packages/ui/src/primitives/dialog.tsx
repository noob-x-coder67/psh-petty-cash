"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "../lib/cn.js";
import { usePrefersReducedMotion } from "../lib/reduced-motion.js";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export interface DialogContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  // Radix drives its own open state internally; AnimatePresence needs the same boolean
  // passed explicitly so it can mount the exit animation before the node is removed —
  // pass the same value given to <Dialog open={...}>.
  open: boolean;
}

export const DialogContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, open, ...props }, ref) => {
    const reducedMotion = usePrefersReducedMotion();
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
                  "psh-focus-ring fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-feature border border-border bg-surface-1 p-6 shadow-3",
                  className,
                )}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
                transition={
                  reducedMotion ? { duration: 0 } : { duration: 0.26, type: "spring", bounce: 0.15 }
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
DialogContent.displayName = "DialogContent";
