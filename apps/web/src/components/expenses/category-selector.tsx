"use client";

import { cn } from "@psh/ui";
import type { KeyboardEvent } from "react";

const CATEGORIES = ["BUILDING", "VEHICLE", "OTHER"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABEL: Record<Category, string> = {
  BUILDING: "Building",
  VEHICLE: "Vehicle",
  OTHER: "Other",
};

const CATEGORY_STYLE: Record<Category, string> = {
  BUILDING: "data-[active=true]:bg-royal-600 data-[active=true]:text-white",
  VEHICLE: "data-[active=true]:bg-violet-500 data-[active=true]:text-white",
  OTHER: "data-[active=true]:bg-amber-500 data-[active=true]:text-white",
};

// SRS §12.4: "category chips" — a single-tap toggle group, not a dropdown (BR-006:
// exactly these three categories, never a fourth). Implements the WAI-ARIA radiogroup
// pattern properly: roving tabindex (only the selected chip is a Tab stop) plus
// Left/Right arrow-key navigation between options, not just click.
export function CategorySelector({
  value,
  onChange,
}: {
  value: Category;
  onChange: (category: Category) => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + CATEGORIES.length) % CATEGORIES.length;
    const nextCategory = CATEGORIES[nextIndex];
    if (nextCategory) onChange(nextCategory);
  }

  return (
    <div role="radiogroup" aria-label="Category" className="flex gap-2">
      {CATEGORIES.map((category, index) => (
        <button
          key={category}
          type="button"
          role="radio"
          aria-checked={value === category}
          tabIndex={value === category ? 0 : -1}
          data-active={value === category}
          onClick={() => onChange(category)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={cn(
            "psh-focus-ring rounded-full border border-border px-3 py-1 text-xs font-medium text-ink-muted transition-colors",
            CATEGORY_STYLE[category],
          )}
        >
          {CATEGORY_LABEL[category]}
        </button>
      ))}
    </div>
  );
}
