"use client";

import { Tooltip, TooltipContent, TooltipTrigger, cn } from "@psh/ui";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "../providers/theme-provider";

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "dark", label: "Dark theme", icon: Moon },
  { value: "system", label: "Match system", icon: Monitor },
];

// A 3-way segmented control rather than a dropdown — with exactly three options, every
// choice stays one click away and visible at a glance, which is clearer than hiding them
// behind a menu (SRS §13.4: "icon-only buttons only with tooltip and accessible label").
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex items-center gap-0.5 rounded-control border border-border bg-surface-0 p-0.5"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={label}
                onClick={() => setTheme(value)}
                className={cn(
                  "psh-focus-ring flex h-7 w-7 items-center justify-center rounded-[calc(var(--radius-control)-2px)] text-ink-muted transition-colors",
                  active && "bg-surface-1 text-primary shadow-1",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
