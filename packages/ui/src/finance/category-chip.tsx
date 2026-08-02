import { cn } from "../lib/cn.js";

export interface CategoryChipProps {
  category: string;
  className?: string;
}

export function CategoryChip({ category, className }: CategoryChipProps) {
  const style = category === "Miscellaneous" ? "bg-amber-100 text-amber-500" : "bg-royal-100 text-royal-600";

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", style, className)}>
      {category}
    </span>
  );
}
