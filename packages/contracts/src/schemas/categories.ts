import { z } from "zod";

// Managed reference data introduced by ADR-0011. IDs are the stable value carried by
// expense writes and report filters; names remain editable display metadata.
export const ExpenseCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  requiresExplanation: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int().positive(),
});
export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;

export const CreateExpenseCategoryRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
}).strict();
export type CreateExpenseCategoryRequest = z.infer<typeof CreateExpenseCategoryRequestSchema>;

export const UpdateExpenseCategoryRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.isActive !== undefined, {
    message: "At least one category field must be supplied",
  });
export type UpdateExpenseCategoryRequest = z.infer<typeof UpdateExpenseCategoryRequestSchema>;

// The caller supplies the complete category set in the desired order. Requiring a full
// permutation prevents omitted rows from acquiring ambiguous or duplicate ranks.
export const ReorderExpenseCategoriesRequestSchema = z.object({
  categoryIds: z.array(z.string().uuid()).min(1),
}).strict();
export type ReorderExpenseCategoriesRequest = z.infer<typeof ReorderExpenseCategoriesRequestSchema>;
