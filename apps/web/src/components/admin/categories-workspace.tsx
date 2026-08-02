"use client";

import type { ExpenseCategory } from "@psh/contracts";
import { Badge, Button, toast } from "@psh/ui";
import { LockKeyhole, Plus, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api-client";
import { CategoriesTable } from "./categories-table";
import { CategoryDetailSheet } from "./category-detail-sheet";
import { CreateCategorySheet } from "./create-category-sheet";

const alphabeticalCollator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function sameOrder(left: ExpenseCategory[], right: ExpenseCategory[]): boolean {
  return left.length === right.length && left.every((category, index) => category.id === right[index]?.id);
}

function isAlphabetical(categories: ExpenseCategory[]): boolean {
  return categories.every(
    (category, index) => index === 0 || alphabeticalCollator.compare(categories[index - 1]!.name, category.name) <= 0,
  );
}

export function CategoriesWorkspace({ initialCategories }: { initialCategories: ExpenseCategory[] }) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailCategoryId, setDetailCategoryId] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  useEffect(() => setCategories(initialCategories), [initialCategories]);

  const hasOrderChanges = !sameOrder(categories, initialCategories);
  const alphabetical = isAlphabetical(categories);
  const explanationCategory = initialCategories.find((category) => category.requiresExplanation);
  const detailCategory = useMemo(
    () => initialCategories.find((category) => category.id === detailCategoryId) ?? null,
    [detailCategoryId, initialCategories],
  );

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    setCategories((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
    setReorderError(null);
  }

  async function saveOrder(): Promise<void> {
    setReorderBusy(true);
    setReorderError(null);
    try {
      const updated = await apiFetch<ExpenseCategory[]>("/admin/categories/order", {
        method: "PUT",
        body: JSON.stringify({ categoryIds: categories.map((category) => category.id) }),
      });
      setCategories(updated);
      toast({ title: "Category order saved", variant: "success" });
      router.refresh();
    } catch (error) {
      setReorderError(error instanceof Error ? error.message : "Failed to save category order");
    } finally {
      setReorderBusy(false);
    }
  }

  async function restoreAlphabetical(): Promise<void> {
    setReorderBusy(true);
    setReorderError(null);
    try {
      const updated = await apiFetch<ExpenseCategory[]>("/admin/categories/order/alphabetical", {
        method: "PUT",
      });
      setCategories(updated);
      toast({
        title: "A–Z order restored",
        description: "All active and inactive categories were reordered.",
        variant: "success",
      });
      router.refresh();
    } catch (error) {
      setReorderError(error instanceof Error ? error.message : "Failed to restore A–Z order");
    } finally {
      setReorderBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-350 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Categories</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Manage category names, availability, and the order used across expenses and reports.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Create category
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface-1 p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <LockKeyhole className="h-4 w-4 text-amber-500" aria-hidden />
            {explanationCategory?.name ?? "Miscellaneous"} explanation rule
            <Badge variant="attention">Immutable</Badge>
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Expenses in {explanationCategory?.name ?? "Miscellaneous"} require an explanation of at least five trimmed
            characters. Administration cannot switch this rule off.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setCategories(initialCategories)}
            disabled={!hasOrderChanges || reorderBusy}
          >
            Discard moves
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void restoreAlphabetical()}
            disabled={(alphabetical && !hasOrderChanges) || reorderBusy}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Restore A–Z
          </Button>
          <Button type="button" size="sm" onClick={() => void saveOrder()} disabled={!hasOrderChanges || reorderBusy}>
            <Save className="h-4 w-4" aria-hidden />
            {reorderBusy ? "Saving…" : "Save order"}
          </Button>
        </div>
      </div>

      {reorderError ? <p className="text-sm text-coral-500">{reorderError}</p> : null}
      <CategoriesTable categories={categories} reorderBusy={reorderBusy} onMove={move} onManage={setDetailCategoryId} />

      <CreateCategorySheet open={createOpen} onOpenChange={setCreateOpen} />
      <CategoryDetailSheet
        category={detailCategory}
        open={detailCategoryId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailCategoryId(null);
        }}
      />
    </div>
  );
}
