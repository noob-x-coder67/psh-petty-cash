"use client";

import type { CreateVoucherRequest, ExpenseCategory } from "@psh/contracts";
import { Button, Input } from "@psh/ui";
import { Trash2 } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { CategorySelector } from "./category-selector";
import { Field } from "./field";

export function LineItemRow({
  categories,
  index,
  onRemove,
}: {
  categories: ExpenseCategory[];
  index: number;
  onRemove?: () => void;
}) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CreateVoucherRequest>();

  const categoryId = watch(`lines.${index}.categoryId`);
  const category = categories.find((candidate) => candidate.id === categoryId);
  const lineErrors = errors.lines?.[index];

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border p-3">
      <div className="flex items-start gap-3">
        <Field label="Description" error={lineErrors?.description?.message} className="flex-1">
          <Input {...register(`lines.${index}.description`)} />
        </Field>
        <Field label="Amount" error={lineErrors?.amount?.message} className="w-32">
          <Input inputMode="decimal" placeholder="0.00" {...register(`lines.${index}.amount`)} />
        </Field>
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="mt-6"
            aria-label={`Remove line ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </div>
      <CategorySelector
        categories={categories}
        value={categoryId}
        onChange={(next) => setValue(`lines.${index}.categoryId`, next, { shouldValidate: true })}
      />
      {category?.requiresExplanation ? (
        <Field label={`${category.name} explanation`} error={lineErrors?.otherExplanation?.message}>
          <Input {...register(`lines.${index}.otherExplanation`)} />
        </Field>
      ) : null}
    </div>
  );
}
