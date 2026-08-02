"use client";

import type { ExpenseCategory } from "@psh/contracts";
import { Badge, Button, EmptyState } from "@psh/ui";
import { ArrowDown, ArrowUp, LockKeyhole, Tags } from "lucide-react";

export function CategoriesTable({
  categories,
  reorderBusy,
  onMove,
  onManage,
}: {
  categories: ExpenseCategory[];
  reorderBusy: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onManage: (categoryId: string) => void;
}) {
  if (categories.length === 0) {
    return <EmptyState icon={Tags} title="No categories yet" description="Create the first expense category." />;
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-0 text-left text-xs font-medium text-ink-muted">
            <th className="w-20 px-4 py-2.5">Order</th>
            <th className="px-4 py-2.5">Category</th>
            <th className="px-4 py-2.5">Explanation policy</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category, index) => (
            <tr key={category.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1">
                  <span className="w-6 text-xs tabular-nums text-ink-muted">{index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5"
                    onClick={() => onMove(index, -1)}
                    disabled={reorderBusy || index === 0}
                    aria-label={`Move ${category.name} up`}
                    title="Move up"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5"
                    onClick={() => onMove(index, 1)}
                    disabled={reorderBusy || index === categories.length - 1}
                    aria-label={`Move ${category.name} down`}
                    title="Move down"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </td>
              <td className="px-4 py-2.5 font-medium text-ink">{category.name}</td>
              <td className="px-4 py-2.5">
                {category.requiresExplanation ? (
                  <Badge variant="attention">
                    <LockKeyhole className="h-3 w-3" aria-hidden />
                    Explanation required
                  </Badge>
                ) : (
                  <span className="text-ink-muted">Standard</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                <Badge variant={category.isActive ? "positive" : "neutral"}>
                  {category.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-right">
                <Button type="button" variant="secondary" size="sm" onClick={() => onManage(category.id)}>
                  Manage
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
