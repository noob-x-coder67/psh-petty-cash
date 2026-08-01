"use client";

import type { ExpenseCategory } from "@psh/contracts";

// ADR-0011 replaces the obsolete three-chip BR-006 control with managed reference
// data. A native select remains keyboard/screen-reader complete even as Finance adds
// categories; richer visual treatment can evolve without changing its value contract.
export function CategorySelector({
  categories,
  value,
  onChange,
}: {
  categories: ExpenseCategory[];
  value: string;
  onChange: (categoryId: string) => void;
}) {
  return (
    <select
      aria-label="Category"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="psh-focus-ring w-full rounded-control border border-border bg-surface-1 px-3 py-2 text-sm text-ink"
    >
      <option value="" disabled>
        Select a category
      </option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
}
