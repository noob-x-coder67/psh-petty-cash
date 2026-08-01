import { cn } from "../lib/cn.js";

const LEGACY_CATEGORY_LABEL: Record<string, string> = {
  BUILDING: "Building",
  VEHICLE: "Vehicle",
  OTHER: "Other",
};

const LEGACY_CATEGORY_STYLE: Record<string, string> = {
  BUILDING: "bg-royal-100 text-royal-600",
  VEHICLE: "bg-violet-100 text-violet-500",
  OTHER: "bg-amber-100 text-amber-500",
};

export interface CategoryChipProps {
  category: string;
  className?: string;
}

export function CategoryChip({ category, className }: CategoryChipProps) {
  const label = LEGACY_CATEGORY_LABEL[category] ?? category;
  const style =
    LEGACY_CATEGORY_STYLE[category] ??
    (category === "Miscellaneous"
      ? "bg-amber-100 text-amber-500"
      : "bg-royal-100 text-royal-600");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        style,
        className,
      )}
    >
      {label}
    </span>
  );
}
