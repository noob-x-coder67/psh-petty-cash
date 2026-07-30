"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CreateUnitRequestSchema, type CreateUnitRequest } from "@psh/contracts";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@psh/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { apiFetch } from "../../lib/api-client";
import { UNIT_TYPE_LABELS, UNIT_TYPE_OPTIONS } from "./unit-type-labels";

// Super-Admin-only (admin.manage_users_units) — the caller gates whether this can even
// be opened; the server independently enforces the same permission on POST /admin/units.
export function CreateUnitSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateUnitRequest>({
    resolver: zodResolver(CreateUnitRequestSchema),
    defaultValues: { code: "", name: "", type: "CENTER", city: "", pettyCashEnabled: false },
  });

  // BR-016/R-11: the form must never even attempt to submit pettyCashEnabled:true for
  // PSH-ISB — not just handle the server's rejection after the fact. Watched against the
  // live code field (not just checked at submit) so the checkbox visibly disables itself
  // the moment someone types the code, matching organization.rules.ts's exact-match check.
  const code = watch("code");
  const isPshIsb = code.trim() === "PSH-ISB";

  function handleClose(): void {
    setServerError(null);
    reset();
    onOpenChange(false);
  }

  async function onSubmit(values: CreateUnitRequest): Promise<void> {
    setServerError(null);
    try {
      await apiFetch("/admin/units", {
        method: "POST",
        body: JSON.stringify({ ...values, pettyCashEnabled: isPshIsb ? false : values.pettyCashEnabled }),
      });
      router.refresh();
      handleClose();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to create unit");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <SheetContent open={open} className="overflow-y-auto p-6">
        <SheetTitle>Create unit</SheetTitle>

        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="mt-4 flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-unit-code">Code</Label>
            <Input id="create-unit-code" {...register("code")} />
            {errors.code ? <p className="text-xs text-coral-500">{errors.code.message}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-unit-name">Name</Label>
            <Input id="create-unit-name" {...register("name")} />
            {errors.name ? <p className="text-xs text-coral-500">{errors.name.message}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-unit-type">Type</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="create-unit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPE_OPTIONS.map((type) => (
                      <SelectItem key={type} value={type}>
                        {UNIT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-unit-city">City</Label>
            <Input id="create-unit-city" {...register("city")} />
          </div>
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="pettyCashEnabled"
              render={({ field }) => (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-2">
                      <Checkbox
                        id="create-unit-petty-cash"
                        checked={field.value}
                        disabled={isPshIsb}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                    </span>
                  </TooltipTrigger>
                  {isPshIsb ? <TooltipContent>PSH-ISB cannot have petty cash enabled</TooltipContent> : null}
                </Tooltip>
              )}
            />
            <Label htmlFor="create-unit-petty-cash" className="font-normal">
              Petty cash enabled
            </Label>
          </div>
          {isPshIsb ? (
            <p className="text-xs text-ink-muted">PSH-ISB never owns a petty-cash account (BR-016).</p>
          ) : null}

          {serverError ? <p className="text-sm text-coral-500">{serverError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create unit"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
