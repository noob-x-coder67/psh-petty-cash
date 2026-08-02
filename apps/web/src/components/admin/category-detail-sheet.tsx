"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  UpdateExpenseCategoryRequestSchema,
  type ExpenseCategory,
  type UpdateExpenseCategoryRequest,
} from "@psh/contracts";
import { Badge, Button, ConfirmationDialog, Input, Label, Sheet, SheetContent, SheetTitle, toast } from "@psh/ui";
import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { apiFetch } from "../../lib/api-client";

export function CategoryDetailSheet({
  category,
  open,
  onOpenChange,
}: {
  category: ExpenseCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<UpdateExpenseCategoryRequest>({
    resolver: zodResolver(UpdateExpenseCategoryRequestSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (category) reset({ name: category.name });
  }, [category, reset]);

  if (!category) return null;
  const currentCategory = category;

  function handleClose(): void {
    setServerError(null);
    setConfirmStatusOpen(false);
    onOpenChange(false);
  }

  async function onSubmit(values: UpdateExpenseCategoryRequest): Promise<void> {
    setServerError(null);
    try {
      const updated = await apiFetch<ExpenseCategory>(`/admin/categories/${currentCategory.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: values.name }),
      });
      toast({
        title: "Category renamed",
        description: `${updated.name} is saved and the complete list is back in A–Z order.`,
        variant: "success",
      });
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to rename category");
    }
  }

  async function changeStatus(): Promise<void> {
    setStatusBusy(true);
    setServerError(null);
    try {
      const updated = await apiFetch<ExpenseCategory>(`/admin/categories/${currentCategory.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !currentCategory.isActive }),
      });
      setConfirmStatusOpen(false);
      toast({
        title: updated.isActive ? "Category activated" : "Category deactivated",
        description: updated.isActive
          ? `${updated.name} is available for new expenses.`
          : `${updated.name} remains visible on historical expenses and reports.`,
        variant: "success",
      });
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to change category status");
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
        <SheetContent open={open} className="overflow-y-auto p-6">
          <SheetTitle>Manage category</SheetTitle>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={currentCategory.isActive ? "positive" : "neutral"}>
              {currentCategory.isActive ? "Active" : "Inactive"}
            </Badge>
            {currentCategory.requiresExplanation ? (
              <Badge variant="attention">
                <LockKeyhole className="h-3 w-3" aria-hidden />
                Explanation required
              </Badge>
            ) : (
              <Badge variant="neutral">Standard explanation policy</Badge>
            )}
          </div>

          {currentCategory.requiresExplanation ? (
            <div className="mt-4 rounded-card border border-amber-200 bg-amber-100/40 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <LockKeyhole className="h-4 w-4 text-amber-500" aria-hidden />
                Immutable expense rule
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                This category always requires an explanation of at least five trimmed characters. Renaming,
                deactivating, or reactivating it cannot change that rule.
              </p>
            </div>
          ) : null}

          <form
            onSubmit={(event) => void handleSubmit(onSubmit)(event)}
            className="mt-5 flex flex-col gap-4"
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-category-name">Name</Label>
              <Input id="edit-category-name" {...register("name")} />
              {errors.name ? <p className="text-xs text-coral-500">{errors.name.message}</p> : null}
              <p className="text-xs text-ink-muted">Renaming restores the complete category list to A–Z order.</p>
            </div>

            {serverError ? <p className="text-sm text-coral-500">{serverError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={handleClose}>
                Close
              </Button>
              <Button type="submit" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? "Saving…" : "Save name"}
              </Button>
            </div>
          </form>

          <section className="mt-6 border-t border-border pt-4">
            <p className="text-xs font-medium text-ink-muted">Availability</p>
            <div className="mt-2 flex items-center justify-between gap-4">
              <p className="text-sm text-ink-muted">
                {currentCategory.isActive
                  ? "Available for new expenses and report filters."
                  : "Retained for history but unavailable on new expenses."}
              </p>
              <Button
                type="button"
                variant={currentCategory.isActive ? "destructive" : "secondary"}
                size="sm"
                onClick={() => setConfirmStatusOpen(true)}
              >
                {currentCategory.isActive ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </section>
        </SheetContent>
      </Sheet>

      <ConfirmationDialog
        open={confirmStatusOpen}
        onOpenChange={setConfirmStatusOpen}
        title={`${currentCategory.isActive ? "Deactivate" : "Activate"} ${currentCategory.name}?`}
        description={
          currentCategory.isActive
            ? "It will no longer be available for new expenses. Existing vouchers and historical reports keep their category."
            : "It will become available for new expenses again. Its explanation rule remains unchanged."
        }
        confirmLabel={currentCategory.isActive ? "Deactivate" : "Activate"}
        destructive={currentCategory.isActive}
        confirmLoading={statusBusy}
        onConfirm={() => void changeStatus()}
      />
    </>
  );
}
