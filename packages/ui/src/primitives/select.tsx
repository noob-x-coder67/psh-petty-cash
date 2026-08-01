import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { cn } from "../lib/cn.js";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "psh-focus-ring flex h-(--control-height-md) w-full min-w-0 items-center justify-between gap-2 rounded-control border border-border bg-surface-1 px-3 text-sm text-ink transition-colors hover:bg-interactive-surface disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {/* Radix's SelectValue drops any className/style passed to it (verified against
        its source — it destructures className off props without spreading it back),
        so truncation has to be applied to a wrapping span here instead. Without this,
        a long unit name wraps to multiple lines and blows out the masthead's height. */}
    <span className="min-w-0 flex-1 truncate text-left">{children}</span>
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        "z-popover overflow-hidden rounded-control border border-border bg-elevated text-ink shadow-3",
        position === "popper" && "min-w-(--radix-select-trigger-width)",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "psh-select-viewport max-h-72 overflow-y-auto overscroll-contain p-1",
          position === "popper" && "w-full",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "psh-focus-ring relative flex w-full cursor-pointer select-none items-center rounded-control py-1.5 pl-7 pr-2 text-sm text-ink outline-none transition-colors data-highlighted:bg-interactive-surface data-disabled:pointer-events-none data-disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5 text-royal-600" aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";
