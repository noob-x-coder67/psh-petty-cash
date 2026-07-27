import { cn } from "../lib/cn.js";

// BR-006: categories are exactly BUILDING, VEHICLE, OTHER — never a fourth.
export type ExpenseCategoryKey = "BUILDING" | "VEHICLE" | "OTHER";

const CATEGORY_LABEL: Record<ExpenseCategoryKey, string> = {
  BUILDING: "Building",
  VEHICLE: "Vehicle",
  OTHER: "Other",
};

const CATEGORY_STYLE: Record<ExpenseCategoryKey, string> = {
  BUILDING: "bg-royal-100 text-royal-600",
  VEHICLE: "bg-violet-100 text-violet-500",
  OTHER: "bg-amber-100 text-amber-500",
};

export interface CategoryChipProps {
  category: ExpenseCategoryKey;
  className?: string;
}

export function CategoryChip({ category, className }: CategoryChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        CATEGORY_STYLE[category],
        className,
      )}
    >
      {CATEGORY_LABEL[category]}
    </span>
  );
}
