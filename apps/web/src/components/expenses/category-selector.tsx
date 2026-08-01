"use client";

import type { ExpenseCategory } from "@psh/contracts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@psh/ui";

// ADR-0011 replaces the obsolete three-chip BR-006 control with managed reference
// data. This uses the shared Select primitive so long managed lists stay bounded and
// internally scrollable everywhere categories are selected.
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
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger aria-label="Category">
        <SelectValue placeholder="Select a category" />
      </SelectTrigger>
      <SelectContent>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
