"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateExpenseCategoryRequestSchema,
  type CreateExpenseCategoryRequest,
  type ExpenseCategory,
} from "@psh/contracts";
import { Button, Input, Label, Sheet, SheetContent, SheetTitle, toast } from "@psh/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { apiFetch } from "../../lib/api-client";

export function CreateCategorySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateExpenseCategoryRequest>({
    resolver: zodResolver(CreateExpenseCategoryRequestSchema),
    defaultValues: { name: "" },
  });

  function handleClose(): void {
    reset();
    setServerError(null);
    onOpenChange(false);
  }

  async function onSubmit(values: CreateExpenseCategoryRequest): Promise<void> {
    setServerError(null);
    try {
      const created = await apiFetch<ExpenseCategory>("/admin/categories", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast({
        title: "Category created",
        description: `${created.name} was added in A–Z order.`,
        variant: "success",
      });
      handleClose();
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to create category");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <SheetContent open={open} className="overflow-y-auto p-6">
        <SheetTitle>Create category</SheetTitle>
        <p className="mt-1 text-sm text-ink-muted">
          Creating a category restores the complete category list to A–Z order.
        </p>

        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="mt-5 flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-category-name">Name</Label>
            <Input id="create-category-name" autoFocus {...register("name")} />
            {errors.name ? <p className="text-xs text-coral-500">{errors.name.message}</p> : null}
          </div>

          <p className="text-xs text-ink-muted">
            New categories use the standard explanation policy. The locked Miscellaneous rule cannot be assigned here.
          </p>
          {serverError ? <p className="text-sm text-coral-500">{serverError}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create category"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
